import { Response } from 'express';
import { Incident } from '../db/schema.js';

// Store active SSE connections
const clients: Set<Response> = new Set();

export function addClient(res: Response): void {
  clients.add(res);
  console.log(`SSE client connected. Total clients: ${clients.size}`);
}

export function removeClient(res: Response): void {
  clients.delete(res);
  console.log(`SSE client disconnected. Total clients: ${clients.size}`);
}

export function broadcastIncident(incident: Incident, eventType: 'created' | 'updated'): void {
  const data = JSON.stringify({
    type: eventType,
    incident,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    try {
      client.write(`event: incident\n`);
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('Error sending SSE to client:', error);
      removeClient(client);
    }
  });
}

export function broadcastBatch(incidents: Incident[], eventType: 'batch_upsert'): void {
  const data = JSON.stringify({
    type: eventType,
    incidents,
    count: incidents.length,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    try {
      client.write(`event: batch\n`);
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('Error sending SSE to client:', error);
      removeClient(client);
    }
  });
}

export function broadcastDeleted(deletedIncidents: Incident[]): void {
  if (deletedIncidents.length === 0) return;

  const data = JSON.stringify({
    type: 'deleted',
    incidents: deletedIncidents,
    deletedIds: deletedIncidents.map(i => i.lsId),
    count: deletedIncidents.length,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    try {
      client.write(`event: deleted\n`);
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      console.error('Error sending SSE to client:', error);
      removeClient(client);
    }
  });
}

export function getClientCount(): number {
  return clients.size;
}
