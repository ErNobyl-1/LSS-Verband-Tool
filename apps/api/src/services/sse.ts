import { Response } from 'express';
import { Incident, AllianceStat, AllianceMember } from '../db/schema.js';
import { createLogger } from '../lib/logger.js';

const logger = createLogger('sse');

// Store active SSE connections
const clients: Set<Response> = new Set();

// Types for SSE data with 24h changes
interface AllianceStatsWithChanges extends AllianceStat {
  change24h: {
    creditsChange: number;
    rankChange: number;
  } | null;
}

interface MembersData {
  members: AllianceMember[];
  counts: { total: number; online: number };
}

export function addClient(res: Response): void {
  clients.add(res);
  logger.debug({ totalClients: clients.size }, 'SSE client connected');
}

export function removeClient(res: Response): void {
  clients.delete(res);
  logger.debug({ totalClients: clients.size }, 'SSE client disconnected');
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
      logger.error({ err: error }, 'Error sending SSE to client');
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
      logger.error({ err: error }, 'Error sending SSE to client');
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
      logger.error({ err: error }, 'Error sending SSE to client');
      removeClient(client);
    }
  });
}

export function getClientCount(): number {
  return clients.size;
}

export function broadcastAllianceStats(stats: AllianceStatsWithChanges): void {
  const data = JSON.stringify({
    type: 'alliance_stats',
    stats,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    try {
      client.write(`event: alliance_stats\n`);
      client.write(`data: ${data}\n\n`);
    } catch (error) {
      logger.error({ err: error }, 'Error sending SSE alliance stats to client');
      removeClient(client);
    }
  });
}

export function broadcastMembers(data: MembersData): void {
  const payload = JSON.stringify({
    type: 'members',
    members: data.members,
    counts: data.counts,
    timestamp: new Date().toISOString(),
  });

  clients.forEach((client) => {
    try {
      client.write(`event: members\n`);
      client.write(`data: ${payload}\n\n`);
    } catch (error) {
      logger.error({ err: error }, 'Error sending SSE members to client');
      removeClient(client);
    }
  });
}
