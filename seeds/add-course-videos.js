import mongoose from 'mongoose';
import { Course } from '../models/index.js';
import { connectDB } from '../config/database.js';

// Connect to database
await connectDB();

// Video courses for age group 1-4 using your existing videos
const courseVideos = [
    {
        id: "101", // Unique ID for course category videos
        title: "Introduction to Sign Language",
        description: "Your first steps into the wonderful world of sign language! Learn basic concepts and simple greetings.",
        video: "/assets/videos/Introduction.mp4", // Using your existing video
        category: "basics",
        ageGroup: "1-4",
        difficulty: "Beginner",
        duration: "5 min",
        durationMinutes: 5,
        instructor: {
            name: "LearnSign Team",
            bio: "Expert sign language instructors"
        },
        skills: ["Basic greetings", "Hand positioning", "Simple gestures"],
        prerequisites: [],
        price: "FREE",
        learningObjectives: [
            "Understand basic sign language concepts",
            "Learn proper hand positioning",
            "Master simple greeting signs"
        ],
        content: {
            sections: [{
                title: "Introduction to Signs",
                description: "Basic introduction to sign language",
                videoUrl: "/assets/videos/Introduction.mp4",
                duration: 5,
                order: 1
            }]
        },
        tags: ["introduction", "basics", "greetings", "beginner"],
        isPublished: true
    },
    {
        id: "102",
        title: "Numbers 1-10",
        description: "Learn to count from 1 to 10 using sign language. Perfect for young learners!",
        video: "/assets/videos/Numbers1.mp4", // Using your existing video
        category: "numbers",
        ageGroup: "1-4",
        difficulty: "Beginner",
        duration: "6 min",
        durationMinutes: 6,
        instructor: {
            name: "LearnSign Team",
            bio: "Expert sign language instructors"
        },
        skills: ["Number recognition", "Counting", "Basic math signs"],
        prerequisites: ["101"],
        price: "FREE",
        learningObjectives: [
            "Sign numbers 1-10 correctly",
            "Count using sign language",
            "Recognize number patterns"
        ],
        content: {
            sections: [{
                title: "Numbers 1-10",
                description: "Learn to count in sign language",
                videoUrl: "/assets/videos/Numbers1.mp4",
                duration: 6,
                order: 1
            }]
        },
        tags: ["numbers", "counting", "math", "beginner"],
        isPublished: true
    },
    {
        id: "103",
        title: "Basic Alphabets A-Z",
        description: "Master the sign language alphabet! Learn all 26 letters step by step.",
        video: "/assets/videos/Alphabets.mp4", // Using your existing video
        category: "letters",
        ageGroup: "1-4",
        difficulty: "Beginner",
        duration: "8 min",
        durationMinutes: 8,
        instructor: {
            name: "LearnSign Team",
            bio: "Expert sign language instructors"
        },
        skills: ["Alphabet recognition", "Letter formation", "Spelling basics"],
        prerequisites: ["101"],
        price: "FREE",
        learningObjectives: [
            "Sign all 26 letters of the alphabet",
            "Spell simple words",
            "Recognize letter patterns"
        ],
        content: {
            sections: [{
                title: "Alphabet A-Z",
                description: "Complete alphabet in sign language",
                videoUrl: "/assets/videos/Alphabets.mp4",
                duration: 8,
                order: 1
            }]
        },
        tags: ["alphabet", "letters", "spelling", "beginner"],
        isPublished: true
    },
    {
        id: "104",
        title: "Family Signs",
        description: "Learn to sign family member names! Mom, Dad, Sister, Brother and more.",
        video: "/assets/videos/family.mp4", // Using your existing video
        category: "family",
        ageGroup: "1-4",
        difficulty: "Beginner",
        duration: "7 min",
        durationMinutes: 7,
        instructor: {
            name: "LearnSign Team",
            bio: "Expert sign language instructors"
        },
        skills: ["Family vocabulary", "Relationships", "Social signs"],
        prerequisites: ["101", "103"],
        price: "FREE",
        learningObjectives: [
            "Sign family member names",
            "Express family relationships",
            "Use possessive signs"
        ],
        content: {
            sections: [{
                title: "Family Members",
                description: "Learn to sign family relationships",
                videoUrl: "/assets/videos/family.mp4",
                duration: 7,
                order: 1
            }]
        },
        tags: ["family", "relationships", "social", "beginner"],
        isPublished: true
    }
];

// Function to add course videos to database
async function addCourseVideos() {
    try {
        console.log('🎬 Adding course videos for age group 1-4...');
        
        for (const video of courseVideos) {
            // Check if video already exists
            const existingVideo = await Course.findOne({ id: video.id });
            
            if (existingVideo) {
                console.log(`⚠️  Course ${video.id} already exists, updating...`);
                await Course.findOneAndUpdate({ id: video.id }, video, { new: true });
                console.log(`✅ Updated course: ${video.title} (ID: ${video.id})`);
            } else {
                // Create new video course
                const newVideo = new Course(video);
                await newVideo.save();
                console.log(`✅ Added course: ${video.title} (ID: ${video.id})`);
            }
        }
        
        console.log('🎉 All course videos added successfully!');
        
        // Display courses for age group 1-4
        const ageGroupCourses = await Course.find({ ageGroup: "1-4" }).select('id title video category duration');
        console.log('\n📋 Courses for Age Group 1-4:');
        ageGroupCourses.forEach(course => {
            console.log(`  - ${course.id}: ${course.title} (${course.duration} min) - ${course.video}`);
        });
        
    } catch (error) {
        console.error('❌ Error adding course videos:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the function
addCourseVideos();
