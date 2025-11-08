import { DrawingState } from "./drawing_state.js";

const USER_COLORS = [
  "#e6194b",
  "#3cb44b",
  "#4363d8",
  "#f58231",
  "#911eb4",
  "#46f0f0",
  "#f032e6",
  "#bcf60c",
  "#fabebe",
  "#008080",
  "#e6beff",
  "#9a6324",
  "#fffac8",
  "#800000",
  "#aaffc3",
  "#808000",
  "#ffd8b1",
  "#000075",
  "#808080",
  "#000000",
];

export class Rooms {
  constructor() {
    this.rooms = new Map();
  }

  ensure(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        users: new Map(),
        state: new DrawingState(),
        colorIndex: 0,
      });
    }
    return this.rooms.get(roomId);
  }

  addUser(roomId, socketId, username = "") {
    const room = this.ensure(roomId);
    const color = USER_COLORS[room.colorIndex % USER_COLORS.length];
    room.colorIndex++;
    const user = {
      id: socketId,
      name: username || `User-${socketId.slice(0, 4)}`,
      color,
    };
    room.users.set(socketId, user);
    return user;
  }

  removeUser(roomId, socketId) {
    const room = this.ensure(roomId);
    room.users.delete(socketId);
  }

  getUsers(roomId) {
    const room = this.ensure(roomId);
    return Array.from(room.users.values());
  }

  getState(roomId) {
    const room = this.ensure(roomId);
    return room.state;
  }
}
