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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var mongodb_1 = require("mongodb");
var dotenv = __importStar(require("dotenv"));
var keyDetection_1 = require("../src/lib/keyDetection");
var path_1 = require("path");
// Load env vars
dotenv.config({ path: (0, path_1.resolve)(__dirname, '../.env.local') });
var uri = process.env.MONGODB_URI;
if (!uri)
    throw new Error("Missing MONGODB_URI");
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var client, dbName, db, collection, songs, updatedCount, _i, songs_1, song, detectedKey;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log("Connecting to MongoDB...");
                    client = new mongodb_1.MongoClient(uri);
                    return [4 /*yield*/, client.connect()];
                case 1:
                    _a.sent();
                    dbName = process.env.MONGODB_DB_NAME || 'gracemusic';
                    db = client.db(dbName);
                    collection = db.collection('songs');
                    return [4 /*yield*/, collection.find({}).toArray()];
                case 2:
                    songs = _a.sent();
                    console.log("Found ".concat(songs.length, " songs. Starting backfill..."));
                    updatedCount = 0;
                    _i = 0, songs_1 = songs;
                    _a.label = 3;
                case 3:
                    if (!(_i < songs_1.length)) return [3 /*break*/, 6];
                    song = songs_1[_i];
                    if (!song.lyrics)
                        return [3 /*break*/, 5];
                    detectedKey = (0, keyDetection_1.detectKey)(song.lyrics);
                    if (!(detectedKey && (song.originalKey !== detectedKey))) return [3 /*break*/, 5];
                    return [4 /*yield*/, collection.updateOne({ _id: song._id }, { $set: { originalKey: detectedKey } })];
                case 4:
                    _a.sent();
                    updatedCount++;
                    console.log("Updated song \"".concat(song.title, "\" -> Key: ").concat(detectedKey));
                    _a.label = 5;
                case 5:
                    _i++;
                    return [3 /*break*/, 3];
                case 6:
                    console.log("\nFinished! Successfully updated ".concat(updatedCount, " songs."));
                    return [4 /*yield*/, client.close()];
                case 7:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
main().catch(console.error);
