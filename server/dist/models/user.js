"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSocket = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// Assume `io` is your Socket.IO server instance
let io;
const AddressSchema = new mongoose_1.Schema({
    address: { type: String },
    city: { type: String },
    state: { type: String },
    country: { type: String },
    zipCode: { type: String },
});
const NotificationSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.default.Schema.Types.ObjectId, required: true },
    itemId: { type: mongoose_1.default.Schema.Types.ObjectId },
    type: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }, // Add this line
});
const UserSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true },
    password: { type: String, required: true },
    profilePicture: { type: String },
    address: AddressSchema,
    events: { type: [mongoose_1.default.Schema.Types.ObjectId], ref: 'Event', default: [] },
    itemsListed: { type: [mongoose_1.default.Schema.Types.ObjectId], ref: 'Item', default: [] },
    itemsLended: { type: [mongoose_1.default.Schema.Types.ObjectId], ref: 'Item', default: [] },
    itemsBorrowed: { type: [mongoose_1.default.Schema.Types.ObjectId], ref: 'Item', default: [] },
    itemsRequested: { type: [mongoose_1.default.Schema.Types.ObjectId], ref: 'Item', default: [] },
    notifications: [NotificationSchema], // Embedded schema
    location: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: {
            type: [Number],
            default: [0.0, 0.0],
        },
    },
});
// Create a 2dsphere index for geospatial queries if location is provided
UserSchema.index({ location: '2dsphere' });
UserSchema.post('save', function (doc) {
    if (io) {
        io.to(`${doc._id}_room`).emit('user_update', doc);
        console.log(`User ${doc._id} has been updated. from save`);
    }
});
UserSchema.post('findOneAndUpdate', function (doc) {
    if (io && doc) {
        io.to(`${doc._id}_room`).emit(`user_update_${doc._id}`, doc);
        console.log(`User ${doc._id} has been updated. from findOneAndUpdate`);
    }
});
// Initialize your Socket.IO instance
const initializeSocket = (socketIO) => {
    io = socketIO;
};
exports.initializeSocket = initializeSocket;
exports.default = mongoose_1.default.model('User', UserSchema);
