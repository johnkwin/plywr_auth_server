import mongoose from 'mongoose';
import User from './models/User.mjs'; // Adjust the path to where your User model is located
import { DB_USER, DB_PASSWORD, DB_NAME } from './config.mjs';

// MongoDB connection
const dbURI = `mongodb://${DB_USER}:${encodeURIComponent(DB_PASSWORD)}@127.0.0.1:27017/${DB_NAME}`;

async function updateUsers() {
    try {
        // Connect to the MongoDB database
        await mongoose.connect(dbURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        // Update all users to add the new fields with null values
        const result = await User.updateMany({}, {
            $set: {
                twitchUserId: null,
                twitchAccessToken: null,
                twitchRefreshToken: null,
                broadcasterId: null,
            }
        });

        console.log(`Updated ${result.nModified} users`);
    } catch (error) {
        console.error('Error updating users:', error);
    } finally {
        // Close the database connection
        mongoose.connection.close();
    }
}

// Run the update
updateUsers();
