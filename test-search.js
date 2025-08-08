// Simple test for search-jobs endpoint
const testData = {
    analysis: {
        technicalSkills: ["JavaScript", "React", "Node.js", "Python", "AWS"],
        workExperience: ["Software Engineer at Google", "Senior Developer at Microsoft"],
        responsibilities: ["Full-stack development", "Team leadership"],
        seniorityLevel: "mid"
    },
    filters: {
        location: "remote",
        salary: "50000"
    }
};

console.log('Testing search-jobs endpoint...');
console.log('Request data:', JSON.stringify(testData, null, 2));

// This is just to show the correct format - the actual request would be made via HTTP
console.log('\nTo test manually, use:');
console.log('POST http://localhost:3000/api/search-jobs');
console.log('Content-Type: application/json');
console.log('Body:', JSON.stringify(testData)); 