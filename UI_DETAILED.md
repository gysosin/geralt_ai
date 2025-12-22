# Geralt AI - Detailed UI & Functional Specification

This document provides a granular breakdown of every UI component and page within the Geralt AI application, serving as a comprehensive blueprint for redesign or refactoring tasks.

---

## 1. Authentication Pages

### 1.1 Login Page (`/login`)
**Purpose:** Entry point for returning users.
**Layout:** Split-screen. Left half is a decorative marketing panel (hidden on mobile), Right half is the authentication form.

**Components:**
*   **Marketing Panel (Left):**
    *   **Visuals:** Dark gradient background (`gradient-primary`), animated text entry (`framer-motion`), decorative circles.
    *   **Content:** Large "Geralt AI" branding, value proposition text ("Future of Document Intelligence"), and feature list with checkmarks (Semantic search, Conversational AI, Security).
*   **Login Form Card (Right):**
    *   **Header:** "Welcome back" title and subtitle. Mobile-only Logo icon.
    *   **Inputs:**
        *   **Email Field:** Standard input with Mail icon.
        *   **Password Field:** Input with Lock icon and **Visibility Toggle** (Eye/EyeOff icon).
    *   **Forgot Password Link:** Text link to password recovery.
    *   **"Sign In" Button:** Full-width gradient button with arrow icon. Shows loading spinner when active.
    *   **Microsoft SSO:** "Sign in with Microsoft" button with MS logo SVG.
    *   **Sign Up Link:** Redirects to `/register`.

### 1.2 Register Page (`/register`)
**Purpose:** User acquisition.
**Layout:** Mirror of Login Page (Marketing Left, Form Right).

**Components:**
*   **Registration Form Card:**
    *   **Inputs:**
        *   **First/Last Name:** 2-column grid layout.
        *   **Email:** Standard input with Mail icon.
        *   **Password & Confirm Password:** Inputs with Lock icons.
    *   **"Create Account" Button:** Full-width gradient button.
    *   **Microsoft SSO:** Alternative signup option.
    *   **Login Link:** For existing users.

---

## 2. Global Application Shell (`MainLayout`)
**Purpose:** Persistent navigation and structure for authenticated pages.

### 2.1 Sidebar (Left Navigation)
**Visuals:** Dark/Contrast background (`bg-sidebar`). 280px wide (desktop expanded), 72px (collapsed).
**Components:**
*   **Header:**
    *   **Logo:** Full "Geralt AI" text + Icon (Expanded) OR Icon only (Collapsed).
    *   **Toggle Button:** Chevron icon to expand/collapse sidebar. Centered when collapsed.
*   **"New Chat" Button:** Gradient background CTA. Shows "+" icon only when collapsed.
*   **Navigation Menu (`ScrollArea`):**
    *   **Items:** Dashboard, Chat, Bots, Collections, Quizzes, Templates, Analytics, History, Profile, Settings.
    *   **Interaction:** Highlight active route (`bg-primary/10`). Tooltips appear on hover when collapsed.
*   **User Footer:**
    *   **Profile:** Avatar + Name/Email (truncated).
    *   **Logout:** Button with log-out icon.

### 2.2 Header (Top Bar)
**Visuals:** Sticky top, blurred background (`backdrop-blur`).
**Components:**
*   **Mobile Menu Trigger:** Hamburger icon (Visible only on mobile). Opens `MobileSidebar`.
*   **Page Title:** Dynamic text based on current route.
*   **Global Search:** "Search conversations..." input (Hidden on mobile).
*   **Actions:**
    *   **Theme Toggle:** Sun/Moon icon to switch Light/Dark/System mode.
    *   **Notifications:** Bell icon with unread badge (red dot).
    *   **User Menu:** Avatar dropdown (Profile, Settings, Logout).

---

## 3. Dashboard (`/dashboard`)
**Purpose:** Landing page, overview, and quick access.
**Layout:** Responsive Grid. Padding `p-4` (mobile) to `p-8` (desktop).

**Components:**
*   **Welcome Section:**
    *   **Greeting:** "Good morning/afternoon, [Name]".
    *   **Action:** "Start New Chat" gradient button.
*   **Stats Grid:**
    *   **Cards (4):** Conversations, AI Bots, Collections, Documents.
    *   **Visuals:** Icon with colored background square, large number value, label.
*   **Quick Actions:**
    *   **Cards (4):** New Conversation, Manage Bots, Browse Collections, View History.
    *   **Visuals:** Gradient hover effects, descriptive text, arrow icon on hover.
*   **Recent Conversations:**
    *   **List:** Top 4 recent chats.
    *   **Item:** Icon, Title, Relative Time, Arrow. Click navigates to chat.
*   **AI Tips:**
    *   **Card:** "AI Tips & Tricks" with list of static advice (e.g., "Be Specific").

---

## 4. Chat Interface (`/chat`)
**Purpose:** Core interaction loop with AI.
**Layout:** 3-Pane: [Sidebar (Desktop/Sheet Mobile)] - [Chat Stream] - [Input Area].

### 4.1 Conversation Sidebar
**Behavior:** Fixed left column on Desktop. `Sheet` (Drawer) on Mobile.
**Components:**
*   **"New Chat" Button:** Top-mounted CTA.
*   **Chat List:** Scrollable list of history.
    *   **Item:** Title, Time.
    *   **Actions:** "More" menu (always visible) -> "Delete".

### 4.2 Main Chat Area
**Components:**
*   **Collection Picker (Header):** Dropdown to select active Knowledge Base (e.g., "Financial Reports", "General").
*   **Empty State:** Shown when new.
    *   **Visuals:** Large Bot icon, "How can I help you?".
    *   **Suggestions:** 4 grid buttons with prompt starters (e.g., "Summarize this...").
*   **Message Stream:**
    *   **User Bubble:** Right-aligned, Primary color, Text-only.
    *   **AI Bubble:** Left-aligned, Gray background.
        *   **Markdown:** Renders bold, lists, code blocks.
        *   **`SourcesList`:** Expandable citations if RAG used docs.
        *   **`SuggestionChips`:** Clickable follow-up questions.
    *   **Typing Indicator:** 3 bouncing dots animation.
*   **Input Area (Footer):**
    *   **`Textarea`:** Auto-resizing.
    *   **Send Button:** Icon changes to Spinner when loading.

---

## 5. Bot Management (`/bots`)
**Purpose:** Create and configure custom AI personas.
**Layout:** Responsive Grid of cards.

**Components:**
*   **Header:** Title + "Create Bot" button.
*   **`BotCard`:**
    *   **Visuals:** Icon, Name, Created Date, truncated Welcome Message.
    *   **Actions:**
        *   **Primary:** "Chat" button (Visible inline).
        *   **Secondary (Dropdown):** Share, Embed Code, Delete.
        *   **Edit:** Pencil icon button.
*   **`CreateBotDialog` (Modal):**
    *   **Form Fields:**
        *   **Name:** Text input.
        *   **Icon URL:** Text input.
        *   **Welcome Message:** Textarea.
        *   **Collections:** Multi-select dropdown to link Knowledge Bases.
        *   **Welcome Buttons:** Dynamic list (Add/Remove) of quick-action buttons for the bot.

---

## 6. Collections (`/collections`)
**Purpose:** Manage document knowledge bases.
**Layout:** Grid of cards.

### 6.1 Main List
**Components:**
*   **`CollectionCard`:**
    *   **Visuals:** Database icon, Name, File count.
    *   **Actions:** Delete (Trash icon).
    *   **Click:** Navigates to Detail view.

### 6.2 Detail View (`/collections/:id`)
**Purpose:** Manage files within a collection.
**Components:**
*   **Header:**
    *   **Editable Name:** Click-to-edit title.
    *   **Public Toggle:** Switch for visibility.
    *   **Actions:** "Share", "Chat" (contextual), "Upload Documents".
*   **File Type Stats:** Card showing count of PDF, DOCX, etc.
*   **`DocumentList`:**
    *   **Table/List:** Filename, Status (Processing/Completed/Failed), Size.
    *   **Actions:** Download, Reprocess, Delete.
*   **`UploadDocumentDialog`:** Drag-and-drop file uploader.

---

## 7. Profile & Settings

### 7.1 Profile Page (`/profile`)
**Purpose:** User personal data.
**Components:**
*   **Avatar Uploader:** Clickable avatar with Camera icon overlay.
*   **Personal Info Form:** First/Last Name, Email (Read-only), Phone, Location, Bio.
*   **Account Stats:** Cards showing "Total Chats", "Queries Made", "Days Active".
*   **"Save Changes" Button.**

### 7.2 Settings Page (`/settings`)
**Purpose:** App preferences.
**Components:**
*   **Appearance:** Theme selector (Light/Dark/System) with visual previews.
*   **Notifications:** Toggles for Email, Push, Sound.
*   **Security:** Toggles for 2FA, "Change Password" button, "View Sessions".
*   **Danger Zone:** Red-bordered card with "Delete Account" button (triggers confirmation modal).

---

## 8. History Page (`/history`)
**Purpose:** Advanced search and management of past chats.
**Components:**
*   **Filters:**
    *   **Search Bar:** Filter by title/content.
    *   **Time:** Buttons (All, Today, Week, Month).
    *   **Sort:** Dropdown (Newest, Oldest, Most Messages).
*   **Bulk Actions:**
    *   **Selection:** Checkboxes on list items.
    *   **Action:** "Delete Selected" button appears when items selected.
*   **List Items:** Detailed cards with Title, Last Message preview, Date, Message count badge.

---
**Note:** All components utilize `shadcn/ui` primitives (Radix UI) and are styled via Tailwind CSS classes. Animations are powered by `framer-motion`.
