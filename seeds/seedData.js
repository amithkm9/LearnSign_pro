import { connectDB } from '../config/database.js';
import { User, Course, Package } from '../models/index.js';

// Seed data for courses
const seedCourses = [
    // Early Learners (Ages 1-4)
    {
        id: "001",
        title: "Introduction to Signs",
        description: "First introduction to the world of sign language",
        video: "/assets/videos/Introduction.mp4",
        ageGroup: "1-4",
        category: "basics",
        duration: "5 min",
        durationMinutes: 5,
        difficulty: "Beginner",
        price: "FREE",
        skills: ["Basic Gestures", "Visual Learning"],
        prerequisites: [],
        learningObjectives: [
            "Understand what sign language is",
            "Learn basic hand movements",
            "Recognize simple signs"
        ],
        tags: ["introduction", "basics", "toddler", "visual"],
        instructor: {
            name: "Sarah Johnson",
            bio: "Certified ASL instructor with 10+ years of experience",
            credentials: ["ASL Certification", "Early Childhood Education"]
        }
    },
    {
        id: "002",
        title: "Simple Numbers",
        description: "Learning to sign numbers 1-10 with fun activities",
        video: "/assets/videos/Numbers1.mp4",
        ageGroup: "1-4",
        category: "numbers",
        duration: "8 min",
        durationMinutes: 8,
        difficulty: "Beginner",
        price: "FREE",
        skills: ["Number Recognition", "Counting"],
        prerequisites: ["001"],
        learningObjectives: [
            "Sign numbers 1-10",
            "Understand number concepts",
            "Practice counting with signs"
        ],
        tags: ["numbers", "counting", "math", "toddler"]
    },
    {
        id: "006",
        title: "Playground Signs",
        description: "Fun signs for playground activities and toys",
        video: "/assets/videos/placeholder.mp4",
        ageGroup: "1-4",
        category: "play",
        duration: "6 min",
        durationMinutes: 6,
        difficulty: "Beginner",
        price: "FREE",
        skills: ["Play Activities", "Social Interaction"],
        prerequisites: ["001"],
        learningObjectives: [
            "Learn playground vocabulary",
            "Sign common toys and games",
            "Interact with other children"
        ],
        tags: ["playground", "toys", "games", "social"]
    },

    // Young Explorers (Ages 5-10)
    {
        id: "003",
        title: "Basic Alphabets",
        description: "Learning the ASL alphabet through interactive methods",
        video: "/assets/videos/Alphabets.mp4",
        ageGroup: "5-10",
        category: "letters",
        duration: "12 min",
        durationMinutes: 12,
        difficulty: "Beginner",
        price: "FREE",
        skills: ["Letter Recognition", "Spelling"],
        prerequisites: ["001"],
        learningObjectives: [
            "Master the ASL alphabet",
            "Spell simple words",
            "Understand fingerspelling"
        ],
        tags: ["alphabet", "letters", "spelling", "fingerspelling"]
    },
    {
        id: "004",
        title: "Family Signs",
        description: "Important family member signs for daily communication",
        video: "/assets/videos/family.mp4",
        ageGroup: "5-10",
        category: "family",
        duration: "10 min",
        durationMinutes: 10,
        difficulty: "Intermediate",
        price: "FREE",
        skills: ["Family Terms", "Relationships"],
        prerequisites: ["001", "003"],
        learningObjectives: [
            "Sign family member names",
            "Understand family relationships",
            "Use family signs in conversation"
        ],
        tags: ["family", "relationships", "parents", "siblings"]
    },
    {
        id: "007",
        title: "School & Learning",
        description: "Essential signs for school environment and learning",
        video: "/assets/videos/placeholder.mp4",
        ageGroup: "5-10",
        category: "education",
        duration: "14 min",
        durationMinutes: 14,
        difficulty: "Intermediate",
        price: "FREE",
        skills: ["Educational Terms", "Classroom Communication"],
        prerequisites: ["003", "004"],
        learningObjectives: [
            "Learn school vocabulary",
            "Communicate in classroom settings",
            "Sign educational activities"
        ],
        tags: ["school", "education", "classroom", "learning"]
    },

    // Advanced Learners (Ages 15+)
    {
        id: "005",
        title: "Emotions & Expressions",
        description: "Express feelings and emotions through sign language",
        video: "/assets/videos/feelings.mp4",
        ageGroup: "15+",
        category: "emotions",
        duration: "15 min",
        durationMinutes: 15,
        difficulty: "Intermediate",
        price: "FREE",
        skills: ["Emotional Expression", "Advanced Communication"],
        prerequisites: ["001", "003", "004"],
        learningObjectives: [
            "Express complex emotions",
            "Understand emotional nuance",
            "Use facial expressions effectively"
        ],
        tags: ["emotions", "feelings", "expressions", "advanced"]
    },
    {
        id: "008",
        title: "Advanced Conversations",
        description: "Complex sentences and natural conversation flow",
        video: "/assets/videos/placeholder.mp4",
        ageGroup: "15+",
        category: "conversation",
        duration: "20 min",
        durationMinutes: 20,
        difficulty: "Advanced",
        price: "FREE",
        skills: ["Complex Grammar", "Fluent Communication"],
        prerequisites: ["003", "004", "005"],
        learningObjectives: [
            "Engage in complex conversations",
            "Use advanced grammar structures",
            "Develop fluency in ASL"
        ],
        tags: ["conversation", "grammar", "fluency", "advanced"]
    }
];

// Seed data for packages
const seedPackages = [
    {
        id: "family-starter",
        title: "Family Starter Pack",
        description: "Perfect for families with children and parents learning together",
        price: "FREE",
        originalPrice: "$199",
        savings: "100%",
        includes: ["Basic Signs", "Family Signs", "Emotions", "Numbers & Letters"],
        ageGroups: ["1-4", "5-10", "15+"],
        features: ["Parent Guide", "Progress Tracking", "Community Access", "Mobile App"],
        popular: true,
        courseIds: ["001", "002", "003", "004", "005", "006"],
        targetAudience: "families",
        benefits: [
            {
                title: "Family Bonding",
                description: "Learn together as a family and strengthen your bonds with learnSign",
                icon: "👨‍👩‍👧‍👦"
            },
            {
                title: "Comprehensive Coverage",
                description: "Covers all essential sign language basics with our proven curriculum",
                icon: "📚"
            }
        ],
        content: {
            duration: {
                estimated: "2-3 months",
                totalHours: 15
            },
            modules: [
                {
                    name: "Getting Started",
                    description: "Introduction and basic concepts",
                    courseIds: ["001", "002"],
                    order: 1
                },
                {
                    name: "Building Vocabulary",
                    description: "Essential signs for daily communication",
                    courseIds: ["003", "004"],
                    order: 2
                },
                {
                    name: "Emotional Expression",
                    description: "Advanced communication skills",
                    courseIds: ["005", "006"],
                    order: 3
                }
            ]
        },
        tags: ["family", "comprehensive", "beginner-friendly", "popular"],
        seoData: {
            slug: "family-starter-pack",
            metaTitle: "Family Starter Pack - Complete Sign Language Learning for Families",
            metaDescription: "Start your family's sign language journey with our comprehensive starter pack. Includes courses for all ages and skill levels.",
            keywords: ["family sign language", "asl for families", "sign language courses", "learning together"]
        }
    },
    {
        id: "parent-child-duo",
        title: "Parent-Child Duo",
        description: "Designed for one-on-one parent-child learning sessions",
        price: "FREE",
        originalPrice: "$149",
        savings: "100%",
        includes: ["Interactive Lessons", "Bonding Activities", "Progress Reports"],
        ageGroups: ["1-4", "5-10"],
        features: ["Duo Learning Mode", "Weekly Challenges", "Achievement Badges"],
        popular: false,
        courseIds: ["001", "002", "003", "006", "007"],
        targetAudience: "parents",
        benefits: [
            {
                title: "One-on-One Learning",
                description: "Perfect for individual parent-child bonding time",
                icon: "👨‍👧"
            },
            {
                title: "Age-Appropriate Content",
                description: "Carefully selected content for young learners",
                icon: "🎯"
            }
        ],
        content: {
            duration: {
                estimated: "6-8 weeks",
                totalHours: 10
            }
        },
        tags: ["parent-child", "bonding", "individual-learning"],
        seoData: {
            slug: "parent-child-duo",
            metaTitle: "Parent-Child Duo Package - Sign Language Learning Together",
            metaDescription: "Special package designed for parent and child to learn sign language together through interactive lessons and bonding activities."
        }
    },
    {
        id: "comprehensive-learning",
        title: "Comprehensive Learning Suite",
        description: "Complete sign language curriculum for all family members",
        price: "FREE",
        originalPrice: "$299",
        savings: "100%",
        includes: ["All Courses", "Advanced Features", "Priority Support", "Offline Content"],
        ageGroups: ["1-4", "5-10", "15+"],
        features: ["Unlimited Access", "Expert Support", "Downloadable Content", "Certificate Program"],
        popular: false,
        courseIds: ["001", "002", "003", "004", "005", "006", "007", "008"],
        targetAudience: "all",
        benefits: [
            {
                title: "Complete Curriculum",
                description: "Everything you need to master sign language",
                icon: "🎓"
            },
            {
                title: "Expert Support",
                description: "Get help from certified ASL instructors",
                icon: "👨‍🏫"
            }
        ],
        content: {
            duration: {
                estimated: "4-6 months",
                totalHours: 25
            }
        },
        tags: ["comprehensive", "complete", "advanced", "expert-support"],
        seoData: {
            slug: "comprehensive-learning-suite",
            metaTitle: "Comprehensive Learning Suite - Complete ASL Curriculum",
            metaDescription: "Master sign language with our complete curriculum including all courses, expert support, and certification program."
        }
    }
];

// Seed function
export const seedDatabase = async () => {
    try {
        console.log('🌱 Starting database seeding...');

        // Connect to database
        await connectDB();

        // Clear existing data (optional - be careful in production!)
        console.log('🗑️  Clearing existing data...');
        await Course.deleteMany({});
        await Package.deleteMany({});
        console.log('✅ Existing data cleared');

        // Seed courses
        console.log('📚 Seeding courses...');
        await Course.insertMany(seedCourses);
        console.log(`✅ ${seedCourses.length} courses seeded successfully`);

        // Seed packages
        console.log('📦 Seeding packages...');
        await Package.insertMany(seedPackages);
        console.log(`✅ ${seedPackages.length} packages seeded successfully`);

        console.log('🎉 Database seeding completed successfully!');
        
        // Display summary
        const courseCount = await Course.countDocuments();
        const packageCount = await Package.countDocuments();
        
        console.log('\n📊 Database Summary:');
        console.log(`   Courses: ${courseCount}`);
        console.log(`   Packages: ${packageCount}`);
        console.log('\n🚀 Your database is ready for use!');

    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
};

// Run seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    seedDatabase()
        .then(() => {
            console.log('✅ Seeding completed. Exiting...');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Seeding failed:', error);
            process.exit(1);
        });
}

export { seedCourses, seedPackages };
