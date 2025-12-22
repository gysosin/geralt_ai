# Geralt AI - UI Component & Architecture Documentation

This document serves as a detailed inventory of the existing UI components and their functionalities within the **Geralt AI** application. It is intended to provide context for AI-driven redesigns, refactoring, or UI/UX improvements.

## 🛠 Tech Stack Context
- **Framework:** React 18+ (Vite)
- **Styling:** Tailwind CSS
- **Component Library:** shadcn/ui (Radix UI primitives)
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **State Management:** Zustand

---

## 1. Global Layout Architecture
Located in: `src/components/layout`

### `MainLayout`
The application shell wrapper.
- **Functionality:** Manages the viewport structure. Handles the responsive switch between desktop and mobile layouts.
- **Structure:** Contains the `Sidebar` (left), `Header` (top), and the main content area (Outlet).
- **Responsive Behavior:** Uses dynamic viewport height (`100dvh`) for mobile browser compatibility.

### `Sidebar` (Navigation)
- **Functionality:** Primary navigation menu.
- **States:**
    - **Desktop:** Collapsible (expands to 280px, collapses to 72px). Persistence of collapsed state.
    - **Mobile:** Hidden by default.
- **Content:**
    - **Logo:** Full logo in expanded state, Icon only in collapsed state.
    - **"New Chat" Button:** Prominent CTA.
    - **Nav Links:** Dashboard, Chat, Bots, Collections, Quizzes, Templates, Analytics, History, Profile, Settings.
    - **User Profile:** Mini-profile at the bottom with Logout functionality.

### `Header`
- **Functionality:** Top navigation bar.
- **Content:**
    - **Mobile Trigger:** Hamburger menu to open `MobileSidebar`.
    - **Page Title:** Dynamic breadcrumb/title.
    - **Global Search:** Input field (currently hidden on mobile) to search across the app.
    - **Actions:** Theme Toggle (Light/Dark/System), Notifications Bell, User Dropdown Menu.

### `CommandPalette` (`src/components/command-palette.tsx`)
- **Functionality:** `Cmd+K` global search interface.
- **Features:** Quick navigation to pages, recent files, and command execution.

---

## 2. Chat Interface (Core Feature)
Located in: `src/components/chat` & `src/pages/chat.tsx`

### `ChatPage` (Controller)
The main conversational interface.
- **Layout:** Three-pane layout (Sidebar | Chat Area | Input).
- **Mobile Behavior:** Sidebar moves to a `Sheet` (Drawer) triggered by a "History" button.

### `ConversationSidebar`
- **Functionality:** Lists historical chat sessions.
- **Features:**
    - **List Items:** Shows title and relative timestamp.
    - **Actions:** "More" menu (three dots) on each item allowing deletion.
    - **State:** Displays Skeleton loaders while fetching.
    - **Selection:** clicking an item navigates to that chat.

### `MessageBubble`
- **Functionality:** Renders individual messages in the chat stream.
- **Variants:**
    - **User:** Right-aligned, primary color background.
    - **AI:** Left-aligned, gray/muted background. Supports Markdown rendering.
- **Sub-components:**
    - **`SourcesList`:** Displays citations/references if the AI used RAG (Retrieval Augmented Generation).
    - **`SuggestionChips`:** Clickable follow-up questions provided by the AI.

### `CollectionPicker`
- **Functionality:** Dropdown/Selector at the top of the chat.
- **Purpose:** Allows the user to select which "Knowledge Collection" (document set) the AI should reference for the current conversation.

### `TypingIndicator`
- **Visual:** Animated dots showing the AI is processing.

---

## 3. Bot Management
Located in: `src/components/bots` & `src/pages/bots.tsx`

### `BotCard`
- **Functionality:** Represents a custom AI bot configuration.
- **Display:** Bot Icon, Name, Description/Welcome Message.
- **Actions:**
    - **Primary:** "Chat" button.
    - **Secondary (Dropdown):** Edit, Share, Embed Code, Delete.

### `CreateBotDialog`
- **Functionality:** Modal form to create or edit a bot.
- **Inputs:** Name, Persona/System Prompt, Model Selection, Knowledge Base association.

### `ShareBotDialog` & `EmbedCodeDialog`
- **Functionality:** specific modals for generating public links or Javascript snippets to embed the bot on external websites.

---

## 4. Knowledge Collections
Located in: `src/components/collections` & `src/pages/collections.tsx`

### `CollectionsPage` (Card Grid)
- **Functionality:** Displays document repositories.
- **Visuals:** Grid of cards showing Collection Name, File Count, and Created Date.
- **Actions:** Create new collection, Delete collection.

*(Note: Detailed file upload and management is handled within the `CollectionDetailPage`)*

---

## 5. Dashboard
Located in: `src/pages/dashboard.tsx` (Inline components)

### `StatsGrid`
- **Functionality:** Key metrics overview.
- **Data:** Total Conversations, Active Bots, Collections, Total Documents.

### `QuickActions`
- **Functionality:** Large, colorful cards for frequent tasks.
- **Items:** New Conversation, Manage Bots, Browse Collections, View History.

### `RecentConversations`
- **Functionality:** A abbreviated list of the most recent chats for quick resumption.

---

## 6. Authentication Pages
Located in: `src/pages/login.tsx` & `src/pages/register.tsx`

### `LoginPage`
- **Layout:** Split screen (Marketing visual on left, Form on right).
- **Components:**
    - **Email/Password Form:** Includes visibility toggle (Eye icon).
    - **Microsoft SSO:** "Sign in with Microsoft" button.
    - **Validation:** Client-side feedback.

---

## 7. Atomic Design System (shadcn/ui)
Located in: `src/components/ui`
These are the building blocks used throughout the components above.

- **`Button`**: Variants (default, destructive, outline, secondary, ghost, link).
- **`Input` / `Textarea`**: Form fields.
- **`Card`**: Container with Header, Title, Content, Footer.
- **`Dialog`**: Modals.
- **`Sheet`**: Slide-out drawers (used for mobile menus).
- **`DropdownMenu`**: Context menus.
- **`ScrollArea`**: Custom scrollbar implementation.
- **`Skeleton`**: Loading placeholders.
- **`Toast`**: Notification popups.
- **`Avatar`**: User/Bot profile images.
- **`Tooltip`**: Hover information.

---

## 🎨 Current Design Aesthetic
- **Theme:** Clean, modern, "Saas" aesthetic.
- **Colors:**
    - Primary: likely a Blue/Purple gradient (`gradient-primary` class used often).
    - Backgrounds: Clean whites/grays (light mode) or deep slates (dark mode).
- **Motion:** Heavy use of `framer-motion` for page transitions (`SlideIn`, `StaggerContainer`) and hover effects.
