# Adding Screenshots to README

To add the screenshots shown in the README, save the images with these exact names in the `docs/screenshots/` folder:

## Required Screenshots

1. **home.png** - Homepage/Landing page showing:
   - Hero section with "Learn Sign Language The Fun Way"
   - Why Choose LearnSign section
   - Testimonials
   - FAQ section

2. **dashboard.png** - Dashboard page showing:
   - Overall Learning Progress (0% display)
   - Weekly Activity chart
   - Progress by Category pie chart
   - Achievement stats
   - Lessons completed metrics

3. **translator.png** - Translator/Recognition page showing:
   - "Learn Sign Language" input section
   - Sign Language Video player
   - Real-time recognition interface
   - Example quick buttons

4. **courses.png** - Course Catalog page showing:
   - "Course Catalog" header
   - Early Learners (Ages 1-4) section
   - Course progress indicators
   - "Start Learning" and "Preview" buttons

5. **community.png** - Community section showing:
   - "Inspiring Journeys" header
   - Success stories (Sudeep Shukla, Nishtha Dudeja, Vaibhav Kothari)
   - Profile cards with tags
   - Descriptions of achievements

## How to Add Screenshots

### Option 1: From Provided Images

1. Save each screenshot with the correct filename
2. Place them in `docs/screenshots/` directory:

```bash
LearnSign/
└── docs/
    └── screenshots/
        ├── home.png
        ├── dashboard.png
        ├── translator.png
        ├── courses.png
        └── community.png
```

### Option 2: Take New Screenshots

1. Run the application locally
2. Navigate to each page
3. Take high-quality screenshots (recommended size: 1920x1080)
4. Crop if necessary to focus on key features
5. Save with the filenames above

### Recommended Screenshot Settings

- **Format**: PNG (for quality)
- **Resolution**: At least 1280x720
- **File Size**: Compress to < 500KB each
- **Quality**: High clarity, readable text

## Alternative: Use Online Screenshots

If you want to deploy first and then add screenshots:

1. Deploy to Railway/hosting platform
2. Visit your live URL
3. Take screenshots of the live site
4. Add them to the docs folder
5. Commit and push:

```bash
git add docs/screenshots/
git commit -m "Add application screenshots to README"
git push origin main
```

## Testing README Display

After adding screenshots:

1. View README on GitHub
2. Check that images display correctly
3. Ensure proper sizing and clarity
4. Verify all screenshots are relevant

## Placeholder Images

Until you add real screenshots, the README will show broken image links. You can either:

1. Add the screenshots as described above
2. Remove the image tags temporarily
3. Use placeholder services like https://placehold.co/

Example with placeholder:
```markdown
![Home Page](https://placehold.co/800x450/6366f1/white?text=LearnSign+Home)
```

---

**Note**: The current README references these screenshots. Make sure to add them before pushing to GitHub for a complete professional presentation!


