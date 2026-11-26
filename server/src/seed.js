require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./config/db');
const User = require('./models/User');
const MentoringRelationship = require('./models/MentoringRelationship');
const Session = require('./models/Session');
const ActionItem = require('./models/ActionItem');
const Goal = require('./models/Goal');
const Notification = require('./models/Notification');
const { executeCarryForward } = require('./services/carryForwardService');

const DEMO_EMAILS = [
  'sarah.mitchell@mentorminutes.dev',
  'alex.rivera@mentorminutes.dev',
  'emily.chen@mentorminutes.dev',
  'marcus.j@mentorminutes.dev',
  'priya.sharma@mentorminutes.dev',
  'david.kim@mentorminutes.dev',
];

/**
 * Safely deletes ONLY records tied to the dedicated demo accounts,
 * leaving all non-demo / production user records untouched.
 */
async function resetDemoData(disconnectAfter = false) {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  const demoUsers = await User.find({ email: { $in: DEMO_EMAILS } }).select('_id');
  const demoUserIds = demoUsers.map((u) => u._id);

  if (demoUserIds.length > 0) {
    const demoRels = await MentoringRelationship.find({
      $or: [{ mentor: { $in: demoUserIds } }, { learner: { $in: demoUserIds } }],
    }).select('_id');
    const demoRelIds = demoRels.map((r) => r._id);

    await Promise.all([
      Notification.deleteMany({ recipient: { $in: demoUserIds } }),
      ActionItem.deleteMany({ relationship: { $in: demoRelIds } }),
      Goal.deleteMany({ relationship: { $in: demoRelIds } }),
      Session.deleteMany({ relationship: { $in: demoRelIds } }),
      MentoringRelationship.deleteMany({ _id: { $in: demoRelIds } }),
      User.deleteMany({ _id: { $in: demoUserIds } }),
    ]);
  }

  console.log('🧹 Safely reset dedicated demo dataset (non-demo records preserved).');

  if (disconnectAfter) {
    await mongoose.disconnect();
  }
}

async function seedDatabase(disconnectAfter = true) {
  console.log('🌱 Starting MentorMinutes Demonstration Data Seeding...');
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  // Safely clear only dedicated demo records before re-seeding
  await resetDemoData(false);

  // 1. Create Mentors
  const mentor1 = await User.create({
    name: 'Dr. Sarah Mitchell',
    email: 'sarah.mitchell@mentorminutes.dev',
    password: 'Password123!',
    role: 'mentor',
    title: 'Principal Software Architect & Tech Lead',
    companyOrSchool: 'Stripe / Tech Mentors Guild',
    bio: '15+ years engineering distributed systems, mentoring junior/senior developers, and guiding career transitions into tech.',
    expertise: ['System Design', 'React/Node Architecture', 'Career Strategy', 'Engineering Leadership'],
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    inviteCode: 'MM-ARCH99',
  });

  const mentor2 = await User.create({
    name: 'Alex Rivera',
    email: 'alex.rivera@mentorminutes.dev',
    password: 'Password123!',
    role: 'mentor',
    title: 'Lead Full-Stack Engineer',
    companyOrSchool: 'Datadog',
    bio: 'Specialist in modern web applications, cloud-native backends, and practical developer career acceleration.',
    expertise: ['TypeScript', 'Full-Stack MERN', 'DevOps & CI/CD', 'Job Search Prep'],
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    inviteCode: 'MM-CODE42',
  });

  // 2. Create Learners
  const learner1 = await User.create({
    name: 'Emily Chen',
    email: 'emily.chen@mentorminutes.dev',
    password: 'Password123!',
    role: 'learner',
    title: 'Junior Frontend Developer',
    companyOrSchool: 'Univ of Washington (Grad 2024)',
    bio: 'Aspiring full-stack engineer transitioning into full-time software engineering roles.',
    interests: ['React', 'Node.js', 'System Architecture', 'Interview Prep'],
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  });

  const learner2 = await User.create({
    name: 'Marcus Johnson',
    email: 'marcus.j@mentorminutes.dev',
    password: 'Password123!',
    role: 'learner',
    title: 'Associate Backend Engineer',
    companyOrSchool: 'FinTech Startup',
    bio: 'Focused on leveling up in API design, microservices, and database performance optimization.',
    interests: ['Database Indexing', 'Distributed Systems', 'Go & Node.js'],
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  });

  const learner3 = await User.create({
    name: 'Priya Sharma',
    email: 'priya.sharma@mentorminutes.dev',
    password: 'Password123!',
    role: 'learner',
    title: 'Computer Science Final Year Student',
    companyOrSchool: 'State University',
    bio: 'Building capstone projects and preparing for software engineering recruitment rounds.',
    interests: ['Web Development', 'Algorithms', 'Cloud Deployments'],
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
  });

  const learner4 = await User.create({
    name: 'David Kim',
    email: 'david.kim@mentorminutes.dev',
    password: 'Password123!',
    role: 'learner',
    title: 'Self-taught Developer',
    companyOrSchool: 'Career Switcher',
    bio: 'Transitioning from accounting into full-stack software development.',
    interests: ['Full-Stack JavaScript', 'Portfolio Building', 'Open Source'],
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  });

  console.log('✅ Created 2 Mentors and 4 Learners.');

  // 3. Mentoring Relationships
  const rel1 = await MentoringRelationship.create({
    mentor: mentor1._id,
    learner: learner1._id,
    topic: 'Full-Stack Architecture & Career Advancement',
    description: 'Weekly 1:1 mentorship guiding Emily from junior developer to mid-level full-stack engineer.',
    meetingFrequency: 'Weekly',
    status: 'active',
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
  });

  const rel2 = await MentoringRelationship.create({
    mentor: mentor1._id,
    learner: learner2._id,
    topic: 'Backend Systems & Database Mastery',
    description: 'Bi-weekly sessions exploring database tuning, API security, and architectural trade-offs.',
    meetingFrequency: 'Bi-weekly',
    status: 'active',
    startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
  });

  const rel3 = await MentoringRelationship.create({
    mentor: mentor2._id,
    learner: learner3._id,
    topic: 'Modern Web Stack & Portfolio Mentorship',
    description: 'Hands-on review of capstone projects and frontend performance engineering.',
    meetingFrequency: 'Weekly',
    status: 'active',
    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  });

  const rel4 = await MentoringRelationship.create({
    mentor: mentor2._id,
    learner: learner4._id,
    topic: 'Career Transition into Tech',
    description: 'Building foundational confidence, coding habits, and interviewing skills.',
    meetingFrequency: 'Weekly',
    status: 'active',
    startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  });

  console.log('✅ Created 4 Mentoring Relationships.');

  // 4. Goals for Relationship 1 (Emily & Dr. Sarah)
  const goal1 = await Goal.create({
    relationship: rel1._id,
    createdBy: mentor1._id,
    title: 'Master Full-Stack REST API & Authentication Architecture',
    description: 'Implement production-ready JWT authentication with refresh flows and role authorization.',
    category: 'technical',
    priority: 'high',
    startDate: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
    targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    status: 'in-progress',
    progress: 75,
    milestones: [
      { title: 'Design user schema and password hashing', completed: true, completedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) },
      { title: 'Implement JWT signing and verification middleware', completed: true, completedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
      { title: 'Add role-based authorization guard', completed: true, completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { title: 'Write integration tests with Supertest', completed: false },
    ],
  });

  const goal2 = await Goal.create({
    relationship: rel1._id,
    createdBy: mentor1._id,
    title: 'Deploy Production Portfolio Project',
    description: 'Build and deploy a full-featured showcase project on Vercel and Render with live demo.',
    category: 'project',
    priority: 'medium',
    startDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
    targetDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
    status: 'in-progress',
    progress: 50,
    milestones: [
      { title: 'Select domain and configure CI/CD pipeline', completed: true, completedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) },
      { title: 'Optimize frontend bundle size with Vite', completed: true, completedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) },
      { title: 'Configure production SSL and environment secrets', completed: false },
      { title: 'Record 2-minute walkthrough demo video', completed: false },
    ],
  });

  const goal3 = await Goal.create({
    relationship: rel1._id,
    createdBy: learner1._id,
    title: 'Revamp Technical Resume and LinkedIn Profile',
    description: 'Showcase quantitative impact and modern tech stack accomplishments.',
    category: 'career',
    priority: 'high',
    startDate: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
    targetDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: 'completed',
    progress: 100,
    completionNotes: 'Resume reviewed and endorsed by Dr. Sarah Mitchell.',
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    milestones: [
      { title: 'Draft experience bullets using STAR method', completed: true, completedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000) },
      { title: 'Review with mentor during Session #2', completed: true, completedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { title: 'Publish updated profile on LinkedIn', completed: true, completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
    ],
  });

  console.log('✅ Created Goals with Milestones.');

  // 5. Sessions & ACTION CARRY-FORWARD Demonstration
  // Session 1 (Completed 14 days ago)
  const session1 = await Session.create({
    relationship: rel1._id,
    sessionNumber: 1,
    title: 'Kickoff: Skill Assessment & Roadmap Planning',
    scheduledDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    durationMinutes: 60,
    status: 'completed',
    agenda: '1. Review current technical skills.\n2. Identify gaps in full-stack architecture.\n3. Establish 3-month mentoring roadmap.',
    topicsDiscussed: 'Explored MERN architecture, async Javascript patterns, and REST API conventions. Decided on focused projects.',
    keyTakeaways: 'Emily has strong React skills but needs deeper backend confidence with data modeling and JWT auth.',
    sharedSummary: 'Great introductory session! We defined clear milestones for auth architecture and project delivery.',
    learnerFeedback: 'Super insightful session! I finally understand where my backend blind spots are.',
    mentorPrivateNotes: 'Emily is highly motivated and absorbs feedback quickly. Keep pushing her to write unit tests.',
  });

  // Action items created in Session 1
  // 1a. Completed item in Session 1 (stays in session 1)
  await ActionItem.create({
    relationship: rel1._id,
    session: session1._id,
    title: 'Setup GitHub repository with ESLint and Prettier configs',
    description: 'Configure standard code style and commit hooks.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'low',
    dueDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    status: 'completed',
    completedAt: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000),
    originalSession: session1._id,
    carryCount: 0,
    carried: false,
  });

  // 1b. Unfinished item in Session 1 that was CARRIED FORWARD to Session 2!
  const actionToCarry1 = await ActionItem.create({
    relationship: rel1._id,
    session: session1._id,
    title: 'Read MongoDB Schema Design Best Practices documentation',
    description: 'Focus on 1-to-many embedding vs referencing patterns.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'medium',
    dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    status: 'in-progress',
    originalSession: session1._id,
    carryCount: 0,
    carried: true, // Marked carried because Session 2 was created!
  });

  // 1c. Another unfinished item carried to Session 2
  const actionToCarry2 = await ActionItem.create({
    relationship: rel1._id,
    session: session1._id,
    title: 'Draft architecture diagram for Mentorship carry-forward module',
    description: 'Diagram the relationship between sessions and persistent action items.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'high',
    dueDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    status: 'pending',
    originalSession: session1._id,
    carryCount: 0,
    carried: true, // Marked carried
  });

  // Session 2 (Completed 7 days ago)
  const session2 = await Session.create({
    relationship: rel1._id,
    sessionNumber: 2,
    title: 'Deep Dive: REST APIs, Mongoose Models & Validation',
    scheduledDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    durationMinutes: 60,
    status: 'completed',
    agenda: '1. Review carried-forward reading and architecture diagrams.\n2. Build Mongoose schemas with validation.\n3. Implement centralized error handling.',
    topicsDiscussed: 'Discussed why action items carry-forward requires idempotency to avoid duplicates. Analyzed Mongoose pre-save hooks and indexing.',
    keyTakeaways: 'Unfinished action items from Session 1 successfully carried forward into this session follow-up list.',
    sharedSummary: 'Productive session deep diving into MongoDB referencing and automatic carry-forward logic.',
    learnerFeedback: 'Carrying forward unfinished tasks between sessions saved so much time reviewing what was left!',
    mentorPrivateNotes: 'She grasped the idempotency concept immediately. Ready to tackle JWT authentication next.',
    carriedActionsCount: 2,
  });

  // The 2 items carried into Session 2:
  // 1. Reading finished during Session 2
  await ActionItem.create({
    relationship: rel1._id,
    session: session2._id,
    title: 'Read MongoDB Schema Design Best Practices documentation',
    description: 'Focus on 1-to-many embedding vs referencing patterns.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'medium',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: 'completed',
    completedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    carried: false,
    carriedForwardFrom: actionToCarry1._id,
    originalSession: session1._id,
    carryCount: 1,
    carryHistory: [
      {
        carriedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        fromSession: session1._id,
        toSession: session2._id,
        reason: 'Unfinished in Session #1 (in-progress)',
      },
    ],
  });

  // 2. The architecture diagram item was NOT finished in Session 2 either, so it is carried AGAIN to Session 3!
  const actionToCarryToSession3 = await ActionItem.create({
    relationship: rel1._id,
    session: session2._id,
    title: 'Draft architecture diagram for Mentorship carry-forward module',
    description: 'Diagram the relationship between sessions and persistent action items.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'high',
    dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    status: 'in-progress',
    carried: true, // Marked carried into Session 3
    carriedForwardFrom: actionToCarry2._id,
    originalSession: session1._id,
    carryCount: 1,
    carryHistory: [
      {
        carriedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        fromSession: session1._id,
        toSession: session2._id,
        reason: 'Unfinished in Session #1 (pending)',
      },
    ],
  });

  // A new action item created in Session 2 that is pending and also carried forward to Session 3:
  const newActionInSession2 = await ActionItem.create({
    relationship: rel1._id,
    session: session2._id,
    title: 'Implement JWT authentication middleware with token expiration check',
    description: 'Ensure 401 response with standardized JSON format when token missing or expired.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'high',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: 'pending',
    originalSession: session2._id,
    carryCount: 0,
    carried: true, // Carried to Session 3
  });

  // Session 3 (Upcoming / Scheduled for Tomorrow)
  const session3 = await Session.create({
    relationship: rel1._id,
    sessionNumber: 3,
    title: 'Authentication Security, Token Validation & Role Guards',
    scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    durationMinutes: 60,
    status: 'scheduled',
    agenda: '1. Review carried-forward architecture diagram (carried from Session 1).\n2. Review JWT auth middleware implementation.\n3. Security review: avoiding token leaks and role escalation.',
    keyTakeaways: '',
    sharedSummary: '',
    learnerFeedback: '',
    mentorPrivateNotes: 'Check if she handled the token expiration gracefully on the frontend Axios interceptor.',
    carriedActionsCount: 2,
  });

  // The 2 items carried into Session 3:
  // Item carried forward for the SECOND time (carryCount = 2, originated in Session 1!)
  await ActionItem.create({
    relationship: rel1._id,
    session: session3._id,
    title: 'Draft architecture diagram for Mentorship carry-forward module',
    description: 'Diagram the relationship between sessions and persistent action items.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'high',
    dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: 'in-progress',
    carried: false,
    carriedForwardFrom: actionToCarryToSession3._id,
    originalSession: session1._id,
    carryCount: 2,
    carryHistory: [
      {
        carriedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        fromSession: session1._id,
        toSession: session2._id,
        reason: 'Unfinished in Session #1 (pending)',
      },
      {
        carriedAt: new Date(),
        fromSession: session2._id,
        toSession: session3._id,
        reason: 'Unfinished in Session #2 (in-progress)',
      },
    ],
  });

  // Item carried forward for the FIRST time (originated in Session 2)
  await ActionItem.create({
    relationship: rel1._id,
    session: session3._id,
    title: 'Implement JWT authentication middleware with token expiration check',
    description: 'Ensure 401 response with standardized JSON format when token missing or expired.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'high',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    status: 'pending',
    carried: false,
    carriedForwardFrom: newActionInSession2._id,
    originalSession: session2._id,
    carryCount: 1,
    carryHistory: [
      {
        carriedAt: new Date(),
        fromSession: session2._id,
        toSession: session3._id,
        reason: 'Unfinished in Session #2 (pending)',
      },
    ],
  });

  // Create an overdue action item for demo testing
  await ActionItem.create({
    relationship: rel1._id,
    session: session2._id,
    title: 'Review OWASP Top 10 Security Checklist for Web Applications',
    description: 'Review common vulnerabilities: injection, broken auth, sensitive data exposure.',
    assignedTo: learner1._id,
    assignedToRole: 'learner',
    createdBy: mentor1._id,
    priority: 'medium',
    dueDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Overdue by 3 days!
    status: 'pending',
    originalSession: session2._id,
    carryCount: 0,
    carried: false,
  });

  // Notifications for users
  await Notification.create({
    recipient: learner1._id,
    title: 'Upcoming Session Tomorrow',
    message: 'Session #3: Authentication Security is scheduled for tomorrow at 10:00 AM.',
    type: 'session',
    link: `/sessions/${session3._id}`,
    read: false,
  });

  await Notification.create({
    recipient: learner1._id,
    title: 'Action Item Carried Forward',
    message: '2 unfinished action items were carried forward into Session #3.',
    type: 'action',
    link: `/sessions/${session3._id}`,
    read: false,
  });

  await Notification.create({
    recipient: mentor1._id,
    title: 'Goal Achieved! 🎯',
    message: 'Emily Chen completed the goal: "Revamp Technical Resume and LinkedIn Profile".',
    type: 'goal',
    link: `/goals`,
    read: true,
  });

  console.log('✅ Created Sessions, Action Items, and Carry-Forward History.');
  console.log('\n======================================================');
  console.log('🎉 DEMO DATA SEEDING COMPLETE!');
  console.log('======================================================');
  console.log('Demo Accounts:');
  console.log('1. Mentor:   sarah.mitchell@mentorminutes.dev  (Password123!)');
  console.log('2. Mentor:   alex.rivera@mentorminutes.dev     (Password123!)');
  console.log('3. Learner:  emily.chen@mentorminutes.dev      (Password123!)');
  console.log('4. Learner:  marcus.j@mentorminutes.dev        (Password123!)');
  console.log('5. Learner:  priya.sharma@mentorminutes.dev    (Password123!)');
  console.log('6. Learner:  david.kim@mentorminutes.dev       (Password123!)');
  console.log('======================================================\n');

  if (disconnectAfter) {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  const isResetOnly = process.argv.includes('--reset');
  const task = isResetOnly ? resetDemoData(true) : seedDatabase(true);
  task
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seeding error:', err);
      process.exit(1);
    });
}

module.exports = seedDatabase;
module.exports.resetDemoData = resetDemoData;
module.exports.DEMO_EMAILS = DEMO_EMAILS;
