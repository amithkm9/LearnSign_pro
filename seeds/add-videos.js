import mongoose from 'mongoose';
import { Course } from '../models/index.js';
import { connectDB } from '../config/database.js';

// Connect to database
await connectDB();

// Sample video data - customize this for your videos
const videoData = [
    {
        id: "006", // Unique ID for each video
        title: "Basic Greetings",
        description: "Learn essential greeting signs like hello, goodbye, please, and thank you",
        video: "/assets/videos/BasicGreetings.mp4", // Path to your video file
        category: "basics",
        ageGroup: "1-4",
        difficulty: "beginner",
        duration: 5, // Duration in minutes
        instructor: {
            name: "LearnSign Team",
            bio: "Expert sign language instructors"
        },
        learningObjectives: [
            "Master basic greeting signs",
            "Understand proper hand positioning",
            "Practice social interaction signs"
        ],
        content: {
            sections: [{
                title: "Introduction to Greetings",
                description: "Overview of basic greeting signs",
                videoUrl: "/assets/videos/BasicGreetings.mp4",
                duration: 5,
                order: 1
            }]
        },
        tags: ["greetings", "basics", "social", "beginner"],
        isPublished: true
    },
    {
        id: "007",
        title: "Family Members",
        description: "Learn to sign family member names and relationships",
        video: "/assets/videos/FamilyMembers.mp4",
        category: "family",
        ageGroup: "5-10",
        difficulty: "beginner",
        duration: 8,
        instructor: {
            name: "LearnSign Team",
            bio: "Expert sign language instructors"
        },
        learningObjectives: [
            "Sign family member names",
            "Express family relationships",
            "Use possessive signs"
        ],
        content: {
            sections: [{
                title: "Family Signs",
                description: "Complete family member vocabulary",
                videoUrl: "/assets/videos/FamilyMembers.mp4",
                duration: 8,
                order: 1
            }]
        },
        tags: ["family", "relationships", "vocabulary"],
        isPublished: true
    },
    {
        id: "008",
        title: "Colors and Shapes",
        description: "Master color and shape signs for everyday communication",
        video: "/assets/videos/ColorsShapes.mp4",
        category: "vocabulary",
        ageGroup: "1-4",
        difficulty: "beginner",
        duration: 6,
        instructor: {
            name: "LearnSign Team",
            bio: "Expert sign language instructors"
        },
        learningObjectives: [
            "Sign primary and secondary colors",
            "Identify basic shapes in sign language",
            "Combine colors with objects"
        ],
        content: {
            sections: [{
                title: "Colors and Shapes",
                description: "Visual vocabulary building",
                videoUrl: "/assets/videos/ColorsShapes.mp4",
                duration: 6,
                order: 1
            }]
        },
        tags: ["colors", "shapes", "vocabulary", "visual"],
        isPublished: true
    }
];

// Function to add videos to database
async function addVideos() {
    try {
        console.log('🎬 Adding videos to database...');
        
        for (const video of videoData) {
            // Check if video already exists
            const existingVideo = await Course.findOne({ id: video.id });
            
            if (existingVideo) {
                console.log(`⚠️  Video ${video.id} already exists, skipping...`);
                continue;
            }
            
            // Create new video course
            const newVideo = new Course(video);
            await newVideo.save();
            
            console.log(`✅ Added video: ${video.title} (ID: ${video.id})`);
        }
        
        console.log('🎉 All videos added successfully!');
        
        // Display all videos
        const allVideos = await Course.find({}).select('id title video category ageGroup');
        console.log('\n📋 Current Videos in Database:');
        allVideos.forEach(video => {
            console.log(`  - ${video.id}: ${video.title} (${video.category}, ${video.ageGroup})`);
        });
        
    } catch (error) {
        console.error('❌ Error adding videos:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the function
addVideos();
