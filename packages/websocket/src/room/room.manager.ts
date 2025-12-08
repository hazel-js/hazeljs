import { Room, WebSocketClient } from '../websocket.types';
import logger from '@hazeljs/core';

/**
 * Room manager for WebSocket connections
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private clientRooms: Map<string, Set<string>> = new Map();

  /**
   * Create a room
   */
  createRoom(name: string): Room {
    if (this.rooms.has(name)) {
      return this.rooms.get(name)!;
    }

    const room: Room = {
      name,
      clients: new Set(),
      metadata: new Map(),
      createdAt: Date.now(),
    };

    this.rooms.set(name, room);
    logger.debug(`Room created: ${name}`);

    return room;
  }

  /**
   * Get a room
   */
  getRoom(name: string): Room | undefined {
    return this.rooms.get(name);
  }

  /**
   * Delete a room
   */
  deleteRoom(name: string): boolean {
    const room = this.rooms.get(name);
    if (!room) {
      return false;
    }

    // Remove room from all clients
    for (const clientId of room.clients) {
      const clientRooms = this.clientRooms.get(clientId);
      if (clientRooms) {
        clientRooms.delete(name);
      }
    }

    this.rooms.delete(name);
    logger.debug(`Room deleted: ${name}`);

    return true;
  }

  /**
   * Add client to room
   */
  addClientToRoom(clientId: string, roomName: string): void {
    // Create room if it doesn't exist
    if (!this.rooms.has(roomName)) {
      this.createRoom(roomName);
    }

    const room = this.rooms.get(roomName)!;
    room.clients.add(clientId);

    // Track client's rooms
    if (!this.clientRooms.has(clientId)) {
      this.clientRooms.set(clientId, new Set());
    }
    this.clientRooms.get(clientId)!.add(roomName);

    logger.debug(`Client ${clientId} joined room ${roomName}`);
  }

  /**
   * Remove client from room
   */
  removeClientFromRoom(clientId: string, roomName: string): void {
    const room = this.rooms.get(roomName);
    if (!room) {
      return;
    }

    room.clients.delete(clientId);

    // Remove from client's rooms
    const clientRooms = this.clientRooms.get(clientId);
    if (clientRooms) {
      clientRooms.delete(roomName);
    }

    // Delete room if empty
    if (room.clients.size === 0) {
      this.deleteRoom(roomName);
    }

    logger.debug(`Client ${clientId} left room ${roomName}`);
  }

  /**
   * Remove client from all rooms
   */
  removeClientFromAllRooms(clientId: string): void {
    const clientRooms = this.clientRooms.get(clientId);
    if (!clientRooms) {
      return;
    }

    for (const roomName of clientRooms) {
      this.removeClientFromRoom(clientId, roomName);
    }

    this.clientRooms.delete(clientId);
    logger.debug(`Client ${clientId} removed from all rooms`);
  }

  /**
   * Get all rooms a client is in
   */
  getClientRooms(clientId: string): string[] {
    const rooms = this.clientRooms.get(clientId);
    return rooms ? Array.from(rooms) : [];
  }

  /**
   * Get all clients in a room
   */
  getRoomClients(roomName: string): string[] {
    const room = this.rooms.get(roomName);
    return room ? Array.from(room.clients) : [];
  }

  /**
   * Check if client is in room
   */
  isClientInRoom(clientId: string, roomName: string): boolean {
    const room = this.rooms.get(roomName);
    return room ? room.clients.has(clientId) : false;
  }

  /**
   * Get all rooms
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * Get room count
   */
  getRoomCount(): number {
    return this.rooms.size;
  }

  /**
   * Get total client count across all rooms
   */
  getTotalClientCount(): number {
    let count = 0;
    for (const room of this.rooms.values()) {
      count += room.clients.size;
    }
    return count;
  }

  /**
   * Broadcast to room
   */
  broadcastToRoom(
    roomName: string,
    event: string,
    data: unknown,
    clients: Map<string, WebSocketClient>,
    excludeClientId?: string
  ): void {
    const room = this.rooms.get(roomName);
    if (!room) {
      return;
    }

    for (const clientId of room.clients) {
      if (excludeClientId && clientId === excludeClientId) {
        continue;
      }

      const client = clients.get(clientId);
      if (client) {
        client.send(event, data);
      }
    }

    logger.debug(`Broadcast to room ${roomName}: ${event}`);
  }

  /**
   * Set room metadata
   */
  setRoomMetadata(roomName: string, key: string, value: unknown): void {
    const room = this.rooms.get(roomName);
    if (room) {
      room.metadata.set(key, value);
    }
  }

  /**
   * Get room metadata
   */
  getRoomMetadata(roomName: string, key: string): unknown {
    const room = this.rooms.get(roomName);
    return room ? room.metadata.get(key) : undefined;
  }

  /**
   * Clear all rooms
   */
  clear(): void {
    this.rooms.clear();
    this.clientRooms.clear();
    logger.info('All rooms cleared');
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRooms: number;
    totalClients: number;
    averageClientsPerRoom: number;
  } {
    const totalRooms = this.rooms.size;
    const totalClients = this.getTotalClientCount();
    const averageClientsPerRoom = totalRooms > 0 ? totalClients / totalRooms : 0;

    return {
      totalRooms,
      totalClients,
      averageClientsPerRoom: Math.round(averageClientsPerRoom * 100) / 100,
    };
  }
}
