/**
 * Definitions for all 50 showcase pages.
 * Each entry maps a URL-friendly ID to a display title.
 */
export type ShowcasePage = { id: string; title: string };

export const showcasePages: ShowcasePage[] = [
    { id: "invoice-tracker", title: "Freelancer Invoice Tracker" },
    { id: "habit-tracker", title: "Habit Tracker Dashboard" },
    { id: "recruitment-pipeline", title: "Recruitment Pipeline" },
    { id: "personal-crm", title: "Personal CRM" },
    { id: "sprint-board", title: "Sprint Board" },
    { id: "reading-list", title: "Reading List & Book Tracker" },
    { id: "expense-report", title: "Expense Report Builder" },
    { id: "content-calendar", title: "Content Calendar" },
    { id: "bug-tracker", title: "Bug Tracker" },
    { id: "meeting-notes", title: "Meeting Notes Repository" },
    { id: "feature-requests", title: "Product Feature Requests" },
    { id: "personal-finance", title: "Personal Finance Dashboard" },
    { id: "gym-workout", title: "Gym Workout Log" },
    { id: "sales-pipeline", title: "Sales Pipeline CRM" },
    { id: "recipe-collection", title: "Recipe Collection" },
    { id: "okr-tracker", title: "OKR Tracker" },
    { id: "support-tickets", title: "Customer Support Tickets" },
    { id: "travel-planner", title: "Travel Planner" },
    { id: "apartment-hunting", title: "Apartment Hunting Tracker" },
    { id: "competitive-analysis", title: "Competitive Analysis Board" },
    { id: "podcast-planner", title: "Podcast Episode Planner" },
    { id: "inventory-management", title: "Inventory Management" },
    { id: "research-papers", title: "Research Paper Organizer" },
    { id: "home-maintenance", title: "Home Maintenance Schedule" },
    { id: "course-curriculum", title: "Course Curriculum Builder" },
    { id: "startup-metrics", title: "Startup Metrics Dashboard" },
    { id: "event-planning", title: "Event Planning Checklist" },
    { id: "job-applications", title: "Job Application Tracker" },
    { id: "client-projects", title: "Client Project Dashboard" },
    { id: "knowledge-base", title: "Personal Knowledge Base" },
    { id: "fleet-management", title: "Fleet Management Tracker" },
    { id: "restaurant-menu", title: "Restaurant Menu Builder" },
    { id: "subscription-manager", title: "Subscription Manager" },
    { id: "changelog", title: "Changelog & Release Notes" },
    { id: "vendor-directory", title: "Vendor & Supplier Directory" },
    { id: "social-media", title: "Social Media Analytics" },
    { id: "plant-care", title: "Plant Care Tracker" },
    { id: "legal-cases", title: "Legal Case Tracker" },
    { id: "language-learning", title: "Language Learning Progress" },
    { id: "real-estate", title: "Real Estate Portfolio" },
    { id: "newsletter-campaigns", title: "Newsletter Campaign Manager" },
    { id: "pet-care", title: "Pet Care Organizer" },
    { id: "wine-cellar", title: "Wine Cellar Inventory" },
    { id: "freelance-pipeline", title: "Freelance Project Pipeline" },
    { id: "boardroom-agenda", title: "Boardroom Meeting Agenda" },
    { id: "health-dashboard", title: "Personal Health Dashboard" },
    { id: "podcast-queue", title: "Podcast Listening Queue" },
    { id: "contractor-bids", title: "Contractor & Vendor Bids" },
    { id: "digital-assets", title: "Digital Asset Manager" },
    { id: "retrospective-board", title: "Retrospective Board" }
];

/** Lookup map for quick page resolution by ID. */
export const showcasePagesMap = new Map(showcasePages.map((p) => [p.id, p]));
