import dgram from 'node:dgram';

const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
const INFO_QUERY = Buffer.concat([
  HEADER,
  Buffer.from([0x54]),
  Buffer.from('Source Engine Query\0', 'ascii'),
]);

function readCString(buffer, offset) {
  const end = buffer.indexOf(0x00, offset);
  if (end === -1) throw new Error('Resposta A2S inválida: string sem terminador.');
  return { value: buffer.toString('utf8', offset, end), next: end + 1 };
}

export function parseA2SInfo(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 15) {
    throw new Error('Resposta A2S incompleta.');
  }

  const header = buffer.readInt32LE(0);
  if (header !== -1) {
    if (header === -2) throw new Error('Resposta A2S fragmentada não suportada.');
    throw new Error('Cabeçalho A2S inválido.');
  }

  if (buffer[4] !== 0x49) {
    throw new Error(`Tipo de resposta A2S inesperado: 0x${buffer[4].toString(16)}.`);
  }

  let offset = 6; // cabeçalho, tipo e protocolo
  const name = readCString(buffer, offset);
  offset = name.next;
  const map = readCString(buffer, offset);
  offset = map.next;
  const folder = readCString(buffer, offset);
  offset = folder.next;
  const game = readCString(buffer, offset);
  offset = game.next;

  if (offset + 9 > buffer.length) throw new Error('Resposta A2S sem dados de jogadores.');

  const appId = buffer.readUInt16LE(offset);
  offset += 2;
  const players = buffer[offset++];
  const maxPlayers = buffer[offset++];
  const bots = buffer[offset++];
  const serverType = String.fromCharCode(buffer[offset++]);
  const environment = String.fromCharCode(buffer[offset++]);
  const visibility = buffer[offset++];
  const vac = buffer[offset++];
  const version = readCString(buffer, offset).value;

  return {
    name: name.value,
    map: map.value,
    folder: folder.value,
    game: game.value,
    appId,
    players,
    maxPlayers,
    bots,
    serverType,
    environment,
    passwordProtected: visibility === 1,
    vacEnabled: vac === 1,
    version,
  };
}

export function queryA2SInfo({ host, port, timeoutMs = 1800 }) {
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket('udp4');
    const startedAt = Date.now();
    let settled = false;

    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.close();
      if (error) reject(error);
      else resolve({ ...result, latencyMs: Date.now() - startedAt });
    };

    const send = (packet) => {
      socket.send(packet, port, host, (error) => {
        if (error) finish(new Error(`Falha ao enviar consulta A2S: ${error.message}`));
      });
    };

    const timer = setTimeout(() => {
      finish(new Error(`A2S não respondeu em ${timeoutMs} ms.`));
    }, timeoutMs);

    socket.once('error', (error) => finish(new Error(`Erro UDP/A2S: ${error.message}`)));
    socket.on('message', (message) => {
      try {
        if (message.length >= 9 && message.readInt32LE(0) === -1 && message[4] === 0x41) {
          send(Buffer.concat([INFO_QUERY, message.subarray(5, 9)]));
          return;
        }
        finish(null, parseA2SInfo(message));
      } catch (error) {
        finish(error);
      }
    });

    send(INFO_QUERY);
  });
}

export function queryA2SPlayers({ host, port, timeoutMs = 2000 }) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let settled = false;

    const finish = (result = []) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      resolve(result);
    };

    const timer = setTimeout(() => finish([]), timeoutMs);
    socket.once('error', () => finish([]));

    const challengeReq = Buffer.concat([HEADER, Buffer.from([0x55, 0xff, 0xff, 0xff, 0xff])]);

    socket.on('message', (msg) => {
      if (msg.length < 5) return;
      if (msg[4] === 0x41 && msg.length >= 9) {
        const challenge = msg.subarray(5, 9);
        const playerReq = Buffer.concat([HEADER, Buffer.from([0x55]), challenge]);
        socket.send(playerReq, port, host);
      } else if (msg[4] === 0x44) {
        const count = msg[5];
        let offset = 6;
        const players = [];
        for (let i = 0; i < count; i++) {
          if (offset >= msg.length) break;
          offset++;
          const end = msg.indexOf(0x00, offset);
          if (end === -1) break;
          const name = msg.toString('utf8', offset, end).trim();
          offset = end + 1;
          const score = msg.readInt32LE(offset);
          offset += 4;
          const duration = msg.readFloatLE(offset);
          offset += 4;
          if (name) {
            players.push({ name, score, durationSec: Math.floor(duration) });
          }
        }
        finish(players);
      }
    });

    socket.send(challengeReq, port, host, (err) => {
      if (err) finish([]);
    });
  });
}
