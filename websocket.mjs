import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';

const clients = new Map();

export function setupWebSocket(server) {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws, req) => {
        ws.on('message', (message) => {
            const { token } = JSON.parse(message);
            try {
                const decoded = jwt.verify(token, 'PSh0JzhGxz6AC0yimgHVUXXVzvM3DGb5');
                clients.set(decoded.userId, ws);
            } catch (err) {
                console.error('Invalid token:', err);
            }
        });

        ws.on('close', () => {
            for (const [userId, clientWs] of clients.entries()) {
                if (clientWs === ws) {
                    clients.delete(userId);
                    break;
                }
            }
        });
    });
}

export function notifyClient(userId) {
    const clientWs = clients.get(userId);
    if (clientWs) {
        clientWs.send(JSON.stringify({ action: 'logout' }));
        clients.delete(userId);
    }
}
