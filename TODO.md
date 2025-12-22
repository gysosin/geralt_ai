# UI Responsiveness & Mobile Optimization TODOs

## Global Layout (`components/layout`)
- [ ] **Mobile Padding**: Standardize content padding. Currently `p-6 lg:p-8` is common. Recommendation: `p-4 md:p-6 lg:p-8` for better mobile real estate usage.
- [ ] **Viewport Height**: Switch `h-screen` to `h-[100dvh]` in `MainLayout` to handle mobile browser address bars (dynamic viewport height) correctly.
- [ ] **Search**: The global search bar in `Header` is `hidden md:flex`. Implement a mobile search toggle (magnifying glass icon that expands an input) or a separate search route for mobile.

## Chat Page (`pages/chat.tsx`)
- [ ] **Critical: Mobile Conversation Sidebar**: The conversation list sidebar is `hidden lg:flex`.
    -   *Action*: Implement a `Sheet` (Drawer) from shadcn/ui to show the conversation list on mobile, triggered by a button in the chat header (e.g., "History" or a burger menu icon distinct from the main nav).
- [ ] **Input Area**: Ensure the chat input sticks to the bottom correctly when the virtual keyboard opens (iOS specific quirks).
- [ ] **Empty State**: optimize `grid-cols-1 sm:grid-cols-2` for suggestion chips. On very small screens, 1 column is good, but check spacing.

## Dashboard (`pages/dashboard.tsx`)
- [ ] **Grid Layouts**: Verify `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`. This is generally good.
- [ ] **Welcome Section**: Ensure the "Start New Chat" button doesn't stretch weirdly or overflow on very narrow screens.

## Bots Page (`pages/bots.tsx`)
- [ ] **Header**: The "Create Bot" button acts as a sibling to the title. On mobile, wrap them: `flex-col sm:flex-row items-start sm:items-center gap-4`.
- [ ] **Bot Cards**:
    -   The action buttons (Chat, Edit, Share, etc.) are in a flex row. On narrow screens, they might overflow.
    -   *Action*: Convert the secondary actions (Edit, Share, Embed, Delete) into a dropdown menu (`<DropdownMenu>`) on mobile, keeping only the primary "Chat" button visible to save space.

## Collections Page (`pages/collections.tsx`)
- [ ] **Mobile Actions**: Similar to Bots page, ensure the "Create Collection" button doesn't crowd the header.
- [ ] **Card Density**: Collections cards are fine, but ensure the "Trash" icon has a large enough touch target (44x44px min).

## shadcn/ui Best Practices
- [ ] **Touch Targets**: Ensure all interactive elements (buttons, inputs, icons) have a minimum touch target of 44x44px.
- [ ] **Font Sizes**: Ensure no font size is smaller than 16px for inputs to prevent iOS from auto-zooming.
- [ ] **Loading States**: Ensure Skeletons (`<Skeleton />`) are used and sized correctly for mobile layouts during data fetching.