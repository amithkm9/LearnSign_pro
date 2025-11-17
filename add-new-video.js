// Quick script to add a new video to LearnSign
import mongoose from 'mongoose';
import { Course } from './models/index.js';
import { connectDB } from './config/database.js';

// Connect to database
await connectDB();

// ========================================
// 🎬 ADD YOUR NEW VIDEO DETAILS HERE
// ========================================

const newVideo = {
    id: "009", // 🔢 CHANGE THIS: Unique ID (use next available number)
    title: "Your Video Title", // 📝 CHANGE THIS: Video title
    description: "Description of what this video teaches", // 📝 CHANGE THIS
    video: "/assets/videos/YourVideoFile.mp4", // 📁 CHANGE THIS: Path to your video file
    category: "basics", // 📂 CHANGE THIS: basics, family, numbers, letters, emotions, etc.
    ageGroup: "1-4", // 👶 CHANGE THIS: "1-4", "5-10", or "15+"
    difficulty: "beginner", // 📊 CHANGE THIS: beginner, intermediate, advanced
    duration: 5, // ⏱️ CHANGE THIS: Duration in minutes
    instructor: {
        name: "LearnSign Team",
        bio: "Expert sign language instructors"
    },
    learningObjectives: [
        "Learning objective 1", // 🎯 CHANGE THIS: What students will learn
        "Learning objective 2",
        "Learning objective 3"
    ],
    content: {
        sections: [{
            title: "Main Section Title", // 📑 CHANGE THIS
            description: "Section description", // 📑 CHANGE THIS
            videoUrl: "/assets/videos/YourVideoFile.mp4", // 📁 Same as video field above
            duration: 5, // ⏱️ Same as duration above
            order: 1
        }]
    },
    tags: ["tag1", "tag2", "tag3"], // 🏷️ CHANGE THIS: Relevant tags
    isPublished: true
};

// ========================================
// 🚀 RUN THIS SCRIPT
// ========================================

async function addNewVideo() {
    try {
        console.log('🎬 Adding new video to database...');
        
        // Check if video ID already exists
        const existingVideo = await Course.findOne({ id: newVideo.id });
        
        if (existingVideo) {
            console.log(`❌ Video with ID ${newVideo.id} already exists!`);
            console.log(`   Please use a different ID number.`);
            return;
        }
        
        // Create new video course
        const video = new Course(newVideo);
        await video.save();
        
        console.log(`✅ Successfully added video: ${newVideo.title}`);
        console.log(`   ID: ${newVideo.id}`);
        console.log(`   Category: ${newVideo.category}`);
        console.log(`   Age Group: ${newVideo.ageGroup}`);
        console.log(`   Video File: ${newVideo.video}`);
        
        console.log('\n🎉 Video added successfully!');
        console.log('📝 Next steps:');
        console.log('   1. Make sure your video file is in /public/assets/videos/');
        console.log('   2. Add the video to your tutorial page (see guide below)');
        console.log(`   3. Test by visiting: http://localhost:3000/tutorials/basics/${newVideo.id}`);
        
    } catch (error) {
        console.error('❌ Error adding video:', error);
    } finally {
        mongoose.connection.close();
    }
}

// Run the function
addNewVideo();
