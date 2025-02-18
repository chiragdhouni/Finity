"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getItemByCategory = exports.getItemByIds = exports.rejectBorrowRequest = exports.searchItems = exports.returnItem = exports.getNearbyItems = exports.lendItem = exports.requestToBorrowItem = exports.addItem = void 0;
const item_1 = __importDefault(require("../models/item"));
const user_1 = __importDefault(require("../models/user"));
// Adding an item to be listed for lending
const addItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { name, description, category, ownerId, dueDate, address } = req.body;
    try {
        if (!name || !description || !category || !ownerId) {
            return res.status(400).send('Missing required fields');
        }
        const owner = yield user_1.default.findById(ownerId);
        if (!owner) {
            return res.status(404).send('Owner not found');
        }
        const item = new item_1.default({
            name,
            description,
            category,
            owner: {
                id: owner._id,
                name: owner.name,
                email: owner.email,
                address: owner.address,
            },
            status: 'available',
            location: owner.location,
            dueDate: dueDate ? new Date(dueDate) : null, // Parse and set the due date if provided
            address: address,
        });
        yield item.save();
        owner.itemsListed.push(item._id);
        yield owner.save();
        res.status(201).send(item);
    }
    catch (error) {
        console.error(`Error adding item: ${error.message}`);
        res.status(400).send(error);
    }
});
exports.addItem = addItem;
// Request to borrow an item
const requestToBorrowItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { itemId, borrowerId } = req.body;
    try {
        const item = yield item_1.default.findById(itemId);
        if (!item) {
            return res.status(404).send('Item not found');
        }
        if (item.status !== 'available') {
            return res.status(400).send('Item is not available for borrowing');
        }
        const borrower = yield user_1.default.findById(borrowerId);
        if (!borrower) {
            return res.status(404).send('Borrower not found');
        }
        borrower.itemsRequested.push(itemId);
        yield borrower.save();
        const owner = yield user_1.default.findById(item.owner.id);
        if (owner) {
            const notification = {
                userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a._id,
                itemId: item._id,
                type: 'borrowRequest',
                message: `Someone has requested to borrow your item: ${item.name}.`,
                read: false,
            };
            owner.notifications.push({
                userId: notification.userId,
                itemId: notification.itemId,
                type: notification.type,
                message: notification.message,
                read: notification.read,
                createdAt: new Date(),
            });
            yield owner.save();
        }
        res.status(200).send({
            message: 'Borrow request submitted',
            item,
            borrower,
        });
    }
    catch (error) {
        console.error(`Error requesting to borrow item: ${error.message}`);
        res.status(500).send('Internal server error');
    }
});
exports.requestToBorrowItem = requestToBorrowItem;
// Lend an item
const lendItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemId, borrowerId, dueDate } = req.body;
    try {
        const item = yield item_1.default.findById(itemId);
        if (!item) {
            return res.status(404).send('Item not found');
        }
        if (item.status !== 'available') {
            return res.status(400).send('Item is not available for lending');
        }
        const borrower = yield user_1.default.findById(borrowerId);
        if (!borrower) {
            return res.status(404).send('Borrower not found');
        }
        item.status = 'lended';
        item.dueDate = dueDate;
        item.borrower = {
            id: borrower._id,
            name: borrower.name,
            email: borrower.email,
            address: borrower.address,
        };
        yield item.save();
        const owner = yield user_1.default.findById(item.owner.id);
        if (owner) {
            owner.itemsLended.push(itemId);
            // Mark the old notification as read and remove it from owner's notifications
            const oldNotification = owner.notifications.find((n) => n.userId.toString() === borrower._id.toString() && n.type === 'borrowRequest');
            if (oldNotification) {
                oldNotification.read = true;
            }
            // owner.notifications.push({
            //   userId: req.user?._id as any,  
            //   itemId: item._id  as any,
            //   type: 'borrowRequestAccepted',
            //   message: `Your borrow request for ${item.name} has been accepted.`,
            //   read: false,
            // });
            yield owner.save();
        }
        borrower.itemsBorrowed.push(itemId);
        borrower.itemsRequested = borrower.itemsRequested.filter((requestedItemId) => requestedItemId.toString() !== itemId.toString());
        borrower.notifications.push({
            userId: item.owner.id,
            itemId: item._id,
            type: 'borrowRequestAccepted',
            message: `Your borrow request for ${item.name} has been accepted.`,
            read: false,
            createdAt: new Date(),
        });
        yield borrower.save();
        res.status(200).send(item);
    }
    catch (error) {
        console.error(`Error lending item: ${error.message}`);
        res.status(400).send(error);
    }
});
exports.lendItem = lendItem;
// Get nearby items
const getNearbyItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { latitude, longitude, maxDistance } = req.query;
    try {
        const items = yield item_1.default.aggregate([
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)],
                    },
                    distanceField: 'dist.calculated',
                    maxDistance: parseFloat(maxDistance), // Maximum distance in meters
                    spherical: true,
                },
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    category: 1,
                    status: 1,
                    owner: 1,
                    borrower: 1,
                    dueDate: 1,
                    location: 1,
                    address: 1,
                },
            },
        ]);
        res.status(200).json(items);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getNearbyItems = getNearbyItems;
// Return an item
const returnItem = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const { itemId } = req.body;
    try {
        const item = yield item_1.default.findById(itemId);
        if (!item) {
            return res.status(404).send('Item not found');
        }
        if (item.status !== 'lended') {
            return res.status(400).send('Item is not currently lended');
        }
        const borrower = yield user_1.default.findById((_a = item.borrower) === null || _a === void 0 ? void 0 : _a.id);
        if (!borrower) {
            return res.status(404).send('Borrower not found');
        }
        borrower.itemsBorrowed = borrower.itemsBorrowed.filter((borrowedItemId) => borrowedItemId.toString() !== itemId.toString());
        yield borrower.save();
        const owner = yield user_1.default.findById(item.owner.id);
        if (owner) {
            owner.itemsLended = owner.itemsLended.filter((lendedItemId) => lendedItemId.toString() !== itemId.toString());
            // Add a notification to the owner that the item was returned
            owner.notifications.push({
                userId: borrower._id,
                itemId: item._id,
                type: 'itemReturned',
                message: `The item ${item.name} has been returned.`,
                read: false,
                createdAt: new Date(),
            });
            yield owner.save();
        }
        // Reset item fields
        item.status = 'available';
        item.dueDate = null;
        item.borrower = null;
        yield item.save();
        res.status(200).send(item);
    }
    catch (error) {
        console.error(`Error returning item: ${error.message}`);
        res.status(400).send(error);
    }
});
exports.returnItem = returnItem;
// Search for items
const searchItems = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = req.query;
    try {
        const items = yield item_1.default.find({ name: { $regex: query, $options: 'i' } });
        res.status(200).json(items);
    }
    catch (error) {
        console.error(`Error searching items: ${error.message}`);
        res.status(400).send(error);
    }
});
exports.searchItems = searchItems;
// Reject borrow request
const rejectBorrowRequest = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemId, borrowerId } = req.body;
    try {
        const item = yield item_1.default.findById(itemId);
        if (!item) {
            return res.status(404).send('Item not found');
        }
        const borrower = yield user_1.default.findById(borrowerId);
        if (!borrower) {
            return res.status(404).send('Borrower not found');
        }
        borrower.itemsRequested = borrower.itemsRequested.filter((requestedItemId) => requestedItemId.toString() !== itemId.toString());
        borrower.notifications.push({
            userId: item.owner.id,
            itemId: item._id,
            type: 'borrowRequestRejected',
            message: `Your borrow request for ${item.name} has been rejected.`,
            read: false,
            createdAt: new Date(),
        });
        yield borrower.save();
        const owner = yield user_1.default.findById(item.owner.id);
        if (owner) {
            owner.notifications.push({
                userId: borrower._id,
                itemId: item._id,
                type: 'borrowRequestRejected',
                message: `You have rejected the borrow request for ${item.name}.`,
                read: false,
                createdAt: new Date(),
            });
            yield owner.save();
        }
        res.status(200).send('Borrow request rejected');
    }
    catch (error) {
        console.error(`Error rejecting borrow request: ${error.message}`);
        res.status(400).send(error);
    }
});
exports.rejectBorrowRequest = rejectBorrowRequest;
const getItemByIds = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { itemIds } = req.body;
    try {
        const items = yield item_1.default.find({ _id: { $in: itemIds } });
        res.status(200).json(items);
    }
    catch (error) {
        console.error(`Error getting items by ids: ${error.message}`);
        res.status(400).send(error);
    }
});
exports.getItemByIds = getItemByIds;
const getItemByCategory = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const { category } = req.query;
    try {
        // Ensure category is provided
        if (!category) {
            return res.status(400).send('Missing required parameter: category');
        }
        // Ensure user location is available
        const userLocation = (_b = (_a = req.user) === null || _a === void 0 ? void 0 : _a.location) === null || _b === void 0 ? void 0 : _b.coordinates;
        if (!userLocation || userLocation.length !== 2) {
            return res.status(400).send('Missing user location (latitude and longitude)');
        }
        // Convert longitude and latitude to string
        const longitude = userLocation[0].toString();
        const latitude = userLocation[1].toString();
        // Check if longitude and latitude are valid strings that can be parsed as numbers
        if (isNaN(parseFloat(longitude)) || isNaN(parseFloat(latitude))) {
            return res.status(400).send('Invalid user location coordinates');
        }
        const items = yield item_1.default.aggregate([
            {
                $geoNear: {
                    near: {
                        type: 'Point',
                        coordinates: [parseFloat(longitude), parseFloat(latitude)], // Parse strings back to numbers
                    },
                    distanceField: 'dist.calculated', // Calculates distance for each item
                    spherical: true,
                },
            },
            {
                $match: {
                    category: category, // Match the category
                    status: 'available', // Only return available items
                },
            },
            {
                $project: {
                    name: 1,
                    description: 1,
                    category: 1,
                    status: 1,
                    owner: 1,
                    borrower: 1,
                    dueDate: 1,
                    location: 1,
                    address: 1,
                },
            },
        ]);
        res.status(200).json(items); // Respond with items
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.getItemByCategory = getItemByCategory;
