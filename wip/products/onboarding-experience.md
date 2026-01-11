# Beauty AI DM Assistant - Onboarding Experience

---

## Document Purpose

This document details the complete onboarding experience for the Beauty AI DM Assistant, covering the journey from signup to first order capture. The goal is to enable shop owners to set up and start capturing orders in under 10 minutes with zero technical knowledge.

**Status**: Draft v1.0
**Date**: 2026-01-11
**Related Docs**:
- beauty-ai-assistant-prd.md
- beauty-ai-product-specification.md

---

## Table of Contents

1. [Onboarding Goals & Principles](#onboarding-goals--principles)
2. [User Authentication Flows](#user-authentication-flows)
3. [Step-by-Step Onboarding](#step-by-step-onboarding)
4. [Success Metrics](#success-metrics)

---

## Onboarding Goals & Principles

### Primary Goal
Enable shop owners to go from signup to capturing their first order in under 10 minutes, with zero technical knowledge required.

### Key Principles

1. **Simplicity First**: Every step must be immediately understandable
2. **Progressive Disclosure**: Only show what's needed at each step
3. **Clear Progress**: Users always know where they are and what's next
4. **Auto-Save Everything**: Never lose user progress
5. **Instant Validation**: Help users fix errors immediately
6. **Celebrate Success**: Make completion feel rewarding

### Success Criteria

- **80%+ completion rate**: Of users who start, 80% complete setup
- **<10 minutes average**: Time from signup to go-live
- **<5% support tickets**: Related to onboarding confusion
- **First order <24 hours**: After completing setup

---

## User Authentication Flows

### Sign Up Journey

**User Flow**:
```
Landing Page → Email Entry → Email Verification → Business Info → Onboarding
```

**Step-by-Step**:

1. **Landing Page**
   - User clicks "Start Free Trial"
   - No credit card required message prominent
   - Clear value proposition visible

2. **Email & Password Entry**
   ```
   ┌──────────────────────────────────────────────────────┐
   │  Start Your Free Trial                               │
   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
   │                                                       │
   │  Email address *                                      │
   │  ┌─────────────────────────────────────────────────┐ │
   │  │ you@example.com                                 │ │
   │  └─────────────────────────────────────────────────┘ │
   │                                                       │
   │  Password *                                           │
   │  ┌─────────────────────────────────────────────────┐ │
   │  │ ••••••••                                        │ │
   │  └─────────────────────────────────────────────────┘ │
   │  ℹ️ At least 8 characters                            │
   │                                                       │
   │  [Create Account]                                     │
   │                                                       │
   │  Already have an account? [Log in]                   │
   └──────────────────────────────────────────────────────┘
   ```

   **Validation**:
   - Email: Valid format, not already registered
   - Password: Minimum 8 characters, mixed case + number
   - Real-time validation as user types
   - Clear error messages inline

3. **Email Verification**
   ```
   ┌──────────────────────────────────────────────────────┐
   │  Verify Your Email                                    │
   │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
   │                                                       │
   │  We sent a 6-digit code to:                          │
   │  you@example.com                                      │
   │                                                       │
   │  Enter code:                                          │
   │  ┌───┬───┬───┬───┬───┬───┐                          │
   │  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │                          │
   │  └───┴───┴───┴───┴───┴───┘                          │
   │                                                       │
   │  Didn't receive it? [Resend code]                    │
   └──────────────────────────────────────────────────────┘
   ```

   **Behavior**:
   - Auto-focus first digit
   - Auto-advance to next digit on entry
   - Auto-submit when 6 digits entered
   - Resend available after 60 seconds
   - Code expires in 10 minutes

4. **Redirect to Onboarding**
   - Once verified, immediately start onboarding
   - Account created in background
   - 14-day trial starts now

---

### Login Journey

**User Flow**:
```
Login Page → Credentials → Dashboard
```

**Login Screen**:
```
┌──────────────────────────────────────────────────────┐
│  Welcome Back                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                       │
│  Email address                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ you@example.com                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Password                                             │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ••••••••                                        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [ ] Remember me     [Forgot password?]              │
│                                                       │
│  [Log In]                                             │
│                                                       │
│  Don't have an account? [Start free trial]           │
└──────────────────────────────────────────────────────┘
```

**With 2FA Enabled**:
```
┌──────────────────────────────────────────────────────┐
│  Two-Factor Authentication                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                       │
│  Enter the 6-digit code from your                    │
│  authenticator app                                    │
│                                                       │
│  ┌───┬───┬───┬───┬───┬───┐                          │
│  │   │   │   │   │   │   │                          │
│  └───┴───┴───┴───┴───┴───┘                          │
│                                                       │
│  [Verify]                                             │
│                                                       │
│  [← Back to login]                                    │
└──────────────────────────────────────────────────────┘
```

---

### Password Reset Journey

**Flow**:
```
Forgot Password → Enter Email → Check Email → Reset Link → New Password
```

**Step 1: Request Reset**:
```
┌──────────────────────────────────────────────────────┐
│  Reset Your Password                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                       │
│  Enter your email address and we'll send you         │
│  a link to reset your password.                      │
│                                                       │
│  Email address                                        │
│  ┌─────────────────────────────────────────────────┐ │
│  │ you@example.com                                 │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [Send Reset Link]                                    │
│                                                       │
│  [← Back to login]                                    │
└──────────────────────────────────────────────────────┘
```

**Step 2: Email Sent Confirmation**:
```
┌──────────────────────────────────────────────────────┐
│  Check Your Email                                     │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                       │
│  We sent a password reset link to:                   │
│  you@example.com                                      │
│                                                       │
│  The link will expire in 1 hour.                     │
│                                                       │
│  Didn't receive it? [Resend link]                    │
│  Wrong email? [Try another email]                    │
└──────────────────────────────────────────────────────┘
```

**Step 3: Set New Password** (after clicking email link):
```
┌──────────────────────────────────────────────────────┐
│  Create New Password                                  │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                       │
│  New password                                         │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ••••••••                                        │ │
│  └─────────────────────────────────────────────────┘ │
│  ℹ️ At least 8 characters                            │
│                                                       │
│  Confirm password                                     │
│  ┌─────────────────────────────────────────────────┐ │
│  │ ••••••••                                        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  [Reset Password]                                     │
└──────────────────────────────────────────────────────┘
```

**Success**:
```
┌──────────────────────────────────────────────────────┐
│  ✓ Password Reset Successful                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                       │
│  Your password has been updated.                     │
│                                                       │
│  [Go to Dashboard]                                    │
└──────────────────────────────────────────────────────┘
```

---

## Step-by-Step Onboarding

### Overview

**Total Time**: 10 minutes
**Steps**: 5 (Setup, Connect, Products, Customize, Go Live)
**Completion Target**: 80%+

**Progress Tracking**:
- Visual progress bar at top
- Step numbers clearly visible
- Can go back to previous steps
- Auto-save on every change
- Can exit and resume later

---

### Step 1: Business Setup (1 minute)

**Goal**: Collect basic business information

**What the user sees**:
```
┌──────────────────────────────────────────────────────────┐
│  Let's set up your beauty business                       │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Progress: ▓▓▓▓░░░░░░░░░░░░ Step 1 of 4                 │
│                                                           │
│  Business name *                                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ My Beauty Shop                                      ││
│  └─────────────────────────────────────────────────────┘│
│  This is how customers will see your business            │
│                                                           │
│  What type of business? *                                │
│  ( ) Beauty Shop  (•) Influencer  ( ) Other              │
│                                                           │
│  What do you sell? *                                     │
│  [✓] Skincare  [ ] Makeup  [ ] Both                      │
│                                                           │
│  Timezone                                                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Asia/Ho_Chi_Minh (GMT+7)              ▼            ││
│  └─────────────────────────────────────────────────────┘│
│  ℹ️ Auto-detected from your location                     │
│                                                           │
│  Currency                                                 │
│  ┌─────────────────────────────────────────────────────┐│
│  │ USD ($)                                  ▼          ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  💾 Auto-saved                          [Continue →]     │
└──────────────────────────────────────────────────────────┘
```

**Field Specifications**:

| Field | Type | Validation | Default | Required |
|-------|------|-----------|---------|----------|
| Business name | Text | 3-100 chars | - | Yes |
| Business type | Radio | Must select one | Shop | Yes |
| Product category | Checkbox | At least one | - | Yes |
| Timezone | Dropdown | Valid timezone | Auto-detected | Yes |
| Currency | Dropdown | Valid currency | Based on timezone | Yes |

**Business Rules**:
- Auto-detect timezone from browser
- Suggest currency based on timezone
- Allow override of both
- Save draft every 5 seconds
- Show "Auto-saved" indicator
- Continue button disabled until all required fields filled
- Can click "Back" to return later (draft saved)

**Error States**:
- Business name too short: "Business name must be at least 3 characters"
- No business type selected: "Please select your business type"
- No product category: "Please select at least one product category"

**Next Action**:
- Click "Continue" → Go to Step 2
- Progress saved automatically

---

### Step 2: Connect Social Media (3 minutes)

**Goal**: Connect at least one social media channel (Instagram or Facebook)

**What the user sees**:
```
┌──────────────────────────────────────────────────────────┐
│  Connect your social media channels                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Progress: ▓▓▓▓▓▓▓▓░░░░░░░░ Step 2 of 4                 │
│                                                           │
│  Choose where you want to capture orders:                │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  📱 Instagram Business                             │ │
│  │  Connect your Instagram account to respond to DMs  │ │
│  │                                                     │ │
│  │  [Connect Instagram]                               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  💬 Facebook Page                                  │ │
│  │  Connect your Facebook Page for Messenger         │ │
│  │                                                     │ │
│  │  [Connect Facebook]                                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ℹ️ You need at least one channel to continue            │
│                                                           │
│  [← Back]                            [Continue →]        │
└──────────────────────────────────────────────────────────┘
```

**Connection States**:

**Before Connection**:
- Button: "Connect Instagram" / "Connect Facebook"
- Help text: "Connect your [platform] to respond to DMs"

**During Connection**:
- Button disabled
- Loading spinner
- Text: "Connecting..."

**After Success**:
```
┌────────────────────────────────────────────────────┐
│  ✅ Instagram Connected                            │
│  @my_beauty_shop                                   │
│  Connected just now                                │
│                                                     │
│  [Reconnect] [Disconnect]                          │
└────────────────────────────────────────────────────┘
```

**OAuth Flow - Facebook**:

1. **User clicks "Connect Facebook"**
   - Opens Facebook OAuth popup
   - System sends user to Facebook authorization

2. **Facebook Permission Screen**:
   ```
   [Facebook OAuth Screen]

   Beauty AI Assistant wants to:
   □ Send and receive messages from your Pages
   □ Read engagement data
   □ Subscribe to webhooks

   Select a Page:
   ( ) My Beauty Shop
   ( ) Another Page

   [Cancel] [Continue as User Name]
   ```

3. **User selects Page and approves**
   - Facebook redirects back to app
   - App receives authorization code
   - App exchanges code for access token
   - App subscribes page to webhooks

4. **Success State**:
   - Show "Connected ✓"
   - Display page name and profile picture
   - Enable "Continue" button

**OAuth Flow - Instagram**:

1. **User clicks "Connect Instagram"**
   - Note: Instagram requires Facebook connection first
   - Opens Facebook OAuth (Instagram access requires Facebook)

2. **Facebook Permission Screen**:
   ```
   [Facebook OAuth Screen]

   Beauty AI Assistant wants to:
   □ Access your Instagram Business Account
   □ Send and receive Instagram messages
   □ Read message engagement

   Select Instagram Account:
   ( ) @my_beauty_shop
   ( ) @another_account

   [Cancel] [Continue]
   ```

3. **User selects account and approves**
   - System verifies it's a Business Account
   - If not business: Show upgrade instructions
   - If business: Continue with connection

4. **Success State**:
   - Show "Connected ✓"
   - Display username and profile picture
   - Enable "Continue" button

**Required Permissions**:

**Facebook**:
- `pages_messaging` - Send and receive messages
- `pages_read_engagement` - Read message engagement
- `pages_manage_metadata` - Subscribe to webhooks

**Instagram**:
- `instagram_basic` - Access Instagram account
- `instagram_manage_messages` - Send/receive Instagram DMs

**Error Scenarios**:

| Error | Cause | User Message | Recovery Action |
|-------|-------|-------------|----------------|
| OAuth Cancelled | User closed popup | "Connection cancelled. Click to try again." | Show "Connect" button again |
| Insufficient Permissions | User denied permissions | "We need these permissions to work: [list]. Please try again." | Show required permissions list |
| Not Business Account | Personal Instagram | "Please convert to Business Account first" + link | Show help article link |
| Connection Timeout | Network issues | "Connection timed out. Please check your internet and try again." | Retry button |
| Token Invalid | Facebook error | "Something went wrong. Please try reconnecting." | Disconnect and reconnect |
| Already Connected | Account already connected to another user | "This account is already connected. Please disconnect it first or use another account." | Show support link |

**Validation Rules**:
- At least 1 channel must be connected to continue
- Webhook verification must succeed
- Access token must be valid
- Continue button disabled until ≥1 connected

**Help & Support**:
- "Need help?" link → Help article
- "Don't have a Business Account?" → Upgrade guide
- "Can't connect?" → Troubleshooting steps

---

### Step 3: Add Products (4 minutes)

**Goal**: Add at least 1 product (with optional variants)

**What the user sees**:
```
┌──────────────────────────────────────────────────────────┐
│  Add your products                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Progress: ▓▓▓▓▓▓▓▓▓▓▓▓░░░░ Step 3 of 4                 │
│                                                           │
│  [Manual Entry] [CSV Upload]                             │
│                                                           │
│  Product 1                                                │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Product name *                                      ││
│  │ Glow Serum                                           ││
│  │                                                      ││
│  │ Price *              Currency                        ││
│  │ 45.00                USD                             ││
│  │                                                      ││
│  │ Description (optional)                               ││
│  │ Brightening vitamin C serum for radiant skin        ││
│  │ 0/500 characters                                     ││
│  │                                                      ││
│  │ Variants (optional) [+ Add variant]                 ││
│  │ ┌─────────────────────────────────────────────────┐ ││
│  │ │ Size: 30ml - $45 (base price) [Remove]         │ ││
│  │ └─────────────────────────────────────────────────┘ ││
│  │ ┌─────────────────────────────────────────────────┐ ││
│  │ │ Size: 50ml - $55 (+$10) [Remove]                │ ││
│  │ └─────────────────────────────────────────────────┘ ││
│  │                                                      ││
│  │ 💾 Saved                                            ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  [+ Add another product]                                 │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Products added: 1    Minimum: 1                         │
│                                                           │
│  💾 Auto-saved     [← Back]            [Continue →]      │
└──────────────────────────────────────────────────────────┘
```

**Product Entry Options**:

**Option 1: Manual Entry** (Default, recommended for <10 products):

**Quick Add Form** (minimum fields):
- Product name (required)
- Price (required)
- Currency (pre-filled)
- [Save Product] button

**Expanded Form** (optional fields):
- Description (0-500 characters)
- Image upload
- Variants (unlimited)

**Adding Variants**:
```
┌─────────────────────────────────────────────────────┐
│  Add Variant                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                      │
│  Variant type                                        │
│  (•) Size  ( ) Shade  ( ) Scent  ( ) Custom         │
│                                                      │
│  Variant name *                                      │
│  ┌──────────────────────────────────────────────┐  │
│  │ 50ml                                         │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  Price modifier                                      │
│  ( ) Same as base price                             │
│  (•) Different price:  +  $10                       │
│                                                      │
│  [Cancel] [Add Variant]                             │
└─────────────────────────────────────────────────────┘
```

**UI Features**:
- Auto-save as user types
- Character counter for description
- "Preview AI response" button
- Drag-and-drop to reorder products
- Expand/collapse product cards
- Inline error messages

**Option 2: CSV Upload** (For 10+ products):

**Upload Interface**:
```
┌──────────────────────────────────────────────────────────┐
│  Import Products from CSV                                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  1. Download our template CSV file                       │
│     [📥 Download Template]                               │
│                                                           │
│  2. Fill in your products                                │
│     Required columns: name, price, currency              │
│     Optional: description, variant_type, variant_name    │
│                                                           │
│  3. Upload your file                                     │
│     ┌────────────────────────────────────────────────┐  │
│     │  Drag CSV file here or [Browse]                │  │
│     └────────────────────────────────────────────────┘  │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**CSV Template Format**:
```csv
Product Name,Price,Currency,Description,Variant Type,Variant Name,Variant Price Modifier
Glow Serum,45,USD,Brightening serum,size,30ml,0
Glow Serum,45,USD,Brightening serum,size,50ml,10
Hydra Cream,55,USD,Moisturizer,,,
Lip Tint,22,USD,Long-lasting color,shade,Rose,0
Lip Tint,22,USD,Long-lasting color,shade,Coral,0
```

**Upload Preview**:
```
┌──────────────────────────────────────────────────────────┐
│  Preview (5 products, 8 rows)                            │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  ✓ Glow Serum - $45 - 2 variants (30ml, 50ml)           │
│  ✓ Hydra Cream - $55 - No variants                      │
│  ✗ Error: Missing price for "Face Wash" (row 4)         │
│  ✓ Lip Tint - $22 - 2 variants (Rose, Coral)            │
│  ⚠️ Warning: Duplicate "Glow Serum" (will update)        │
│                                                           │
│  Status: 4 valid, 1 error, 1 warning                     │
│                                                           │
│  [Fix Errors Manually] [Import Valid Products] [Cancel]  │
└──────────────────────────────────────────────────────────┘
```

**Field Validation**:

| Field | Validation | Error Message |
|-------|-----------|---------------|
| Product name | 3-100 chars | "Name must be 3-100 characters" |
| Price | > 0, numeric | "Price must be greater than 0" |
| Description | 0-500 chars | "Description too long (500 max)" |
| Variant name | 1-100 chars | "Variant name required" |
| Price modifier | Numeric | "Must be a number" |

**Business Rules**:
- Minimum 1 product required to continue
- No duplicate product names (case-insensitive)
- Variants optional
- Products auto-save on blur
- Can add unlimited products
- Can edit products after saving
- Can delete products (with confirmation)

**Success States**:
- Green checkmark on saved product
- "Saved" indicator
- Continue button enabled when ≥1 product

---

### Step 4: Customize AI Behavior (2 minutes)

**Goal**: Configure AI personality and handoff rules

**What the user sees**:
```
┌──────────────────────────────────────────────────────────┐
│  Customize your AI assistant                             │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Progress: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Step 4 of 4                 │
│                                                           │
│  Choose your brand tone *                                │
│  How should your AI talk to customers?                   │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ (•) Friendly - Casual, warm, emoji-friendly        │ │
│  │                                                     │ │
│  │     Preview conversation:                           │ │
│  │     Customer: "How much is the serum?"             │ │
│  │     AI: "Hey! 😊 The Glow Serum is $45.            │ │
│  │          Want to order?"                            │ │
│  │                                                     │ │
│  │     [Listen to voice sample 🔊]                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ( ) Luxe - Premium, sophisticated, professional    │ │
│  │                                                     │ │
│  │     Preview conversation:                           │ │
│  │     Customer: "How much is the serum?"             │ │
│  │     AI: "Good day. The Glow Serum is priced        │ │
│  │          at $45. Would you like to order?"         │ │
│  │                                                     │ │
│  │     [Listen to voice sample 🔊]                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ( ) Influencer - Personal, authentic, relatable    │ │
│  │                                                     │ │
│  │     Preview conversation:                           │ │
│  │     Customer: "How much is the serum?"             │ │
│  │     AI: "Omg the Glow Serum is $45! 💕 It's        │ │
│  │          sooo good! Want one?"                      │ │
│  │                                                     │ │
│  │     [Listen to voice sample 🔊]                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Hand off to you when:                                   │
│  [✓] Customer asks medical/health questions              │
│  [✓] Customer requests custom orders                     │
│  [✓] Customer seems unhappy                              │
│  [✓] Order is confirmed (always on, can't disable)       │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Response speed                                           │
│  (•) Instant (<1s)     ( ) Delayed (1-3s, more human)    │
│                                                           │
│  Operating hours                                          │
│  (•) Always active (24/7)                                │
│  ( ) Custom schedule [Set hours →]                       │
│                                                           │
│  💾 Auto-saved     [← Back]     [Complete Setup →]       │
└──────────────────────────────────────────────────────────┘
```

**Brand Tone Options**:

**1. Friendly**:
- **Best for**: Casual beauty shops, approachable brands
- **Characteristics**:
  - Emojis: Moderate use (😊 💕 ✨)
  - Language: Casual, warm
  - Punctuation: Exclamation points common
- **Example greeting**: "Hey there! 😊 How can I help you today?"
- **Example price**: "The Glow Serum is $45! Want to order?"
- **Example handoff**: "Thanks! The owner will message you soon 💕"

**2. Luxe**:
- **Best for**: Premium brands, high-end beauty, luxury shops
- **Characteristics**:
  - Emojis: Minimal or none
  - Language: Formal, sophisticated
  - Punctuation: Periods, professional
- **Example greeting**: "Good day. How may I assist you with your beauty needs?"
- **Example price**: "The Glow Serum is priced at $45. Would you like to place an order?"
- **Example handoff**: "Thank you. The owner will contact you shortly."

**3. Influencer**:
- **Best for**: Personal brands, creator-driven shops, social media personalities
- **Characteristics**:
  - Emojis: Heavy use (💕 😍 ✨ 🎉)
  - Language: Very casual, enthusiastic
  - Punctuation: Multiple exclamations!!
- **Example greeting**: "Omg hiiii! 💕 What are you looking for today?"
- **Example price**: "The Glow Serum is $45! It's literally my fave 😍 Want one??"
- **Example handoff**: "Yayyy! 🎉 The owner will DM you soon!"

**Interactive Preview**:
- Click each tone to see full conversation preview
- Optional: Voice sample (text-to-speech)
- Shows 3-4 message exchange example
- Can switch between tones to compare

**Auto-Handoff Triggers**:

| Trigger | Default | Can Disable? | Reason |
|---------|---------|-------------|--------|
| Medical questions | ON | No | Safety critical |
| Custom requests | ON | Yes | Seller choice |
| Negative sentiment | ON | Yes | Seller choice |
| Order confirmed | ON | No | Required for payment |
| Low AI confidence | ON | No | Quality control |

**Help Text**:
- "Medical questions": "AI will hand off questions about skin conditions, allergies, treatments"
- "Custom requests": "Special orders, modifications, bulk inquiries"
- "Negative sentiment": "Complaints, dissatisfaction, angry customers"
- "Order confirmed": "Always hands off for payment and shipping"

**Response Speed**:
- **Instant (<1s)**: Feels more automated, efficient
- **Delayed (1-3s)**: Shows "typing..." indicator, feels more human

**Operating Hours**:
- **Always active (24/7)**: AI responds anytime
- **Custom schedule**: Set hours by day (Mon-Sun, different times each day)
  - Outside hours: "Thanks for messaging! I'll connect you with the owner when they're available [hours]."

**Custom Schedule Interface** (if clicked):
```
┌──────────────────────────────────────────────────────────┐
│  Set Operating Hours                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Timezone: Asia/Ho_Chi_Minh (GMT+7)                      │
│                                                           │
│  Monday     [✓] 09:00 - 18:00                            │
│  Tuesday    [✓] 09:00 - 18:00                            │
│  Wednesday  [✓] 09:00 - 18:00                            │
│  Thursday   [✓] 09:00 - 18:00                            │
│  Friday     [✓] 09:00 - 18:00                            │
│  Saturday   [✓] 10:00 - 16:00                            │
│  Sunday     [ ] Closed                                    │
│                                                           │
│  [Copy Mon-Fri to all days]                              │
│                                                           │
│  [Cancel] [Save Hours]                                    │
└──────────────────────────────────────────────────────────┘
```

**Validation**:
- Must select at least one brand tone
- Operating hours: If custom, must have at least 1 active day

---

### Step 5: Test & Go Live (30 seconds)

**Goal**: Confirm setup is complete and encourage testing

**What the user sees**:
```
┌──────────────────────────────────────────────────────────┐
│  🎉 You're all set!                                      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  Progress: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ Complete!                    │
│                                                           │
│  Your AI assistant is now active on:                     │
│  ✓ Instagram @my_beauty_shop                            │
│  ✓ Facebook Page: My Beauty Shop                        │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Setup Checklist:                                         │
│  ✓ Business information                                  │
│  ✓ 1 channel connected                                   │
│  ✓ 3 products added                                      │
│  ✓ AI configured (Friendly tone)                         │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Test it now:                                             │
│  1. Send a DM to your Instagram or Facebook page         │
│  2. Try: "How much is the Glow Serum?"                   │
│  3. See your AI respond instantly!                        │
│                                                           │
│  [📺 Watch 2-Minute Video Tutorial]                      │
│                                                           │
│  Status: ● Listening for messages...                     │
│                                                           │
│  [Go to Dashboard]                                        │
└──────────────────────────────────────────────────────────┘
```

**Celebration Elements**:
- Confetti animation on page load
- Success checkmarks
- Positive messaging
- Clear next steps

**Real-Time Status Indicators**:

**Listening** (initial state):
```
Status: ● Listening for messages...
```

**First Message Received**:
```
┌──────────────────────────────────────────────────────┐
│  🎉 First message received!                          │
│                                                       │
│  @test_customer just messaged:                       │
│  "How much is the Glow Serum?"                       │
│                                                       │
│  Your AI responded:                                   │
│  "Hey! 😊 The Glow Serum is $45! Want to order?"    │
│                                                       │
│  [View Full Conversation]                            │
└──────────────────────────────────────────────────────┘
```

**AI Responded Successfully**:
```
Status: ✓ AI is responding successfully
         1 conversation active
```

**Test Conversation Preview**:
- Shows last 3-5 messages
- Updates in real-time
- Can click to view full conversation
- Encourages testing with sample questions

**Next Steps Guidance**:
```
┌──────────────────────────────────────────────────────┐
│  What happens next?                                   │
│                                                       │
│  1. Customers message you on Instagram/Facebook      │
│  2. AI responds automatically with product info      │
│  3. When they want to order, AI collects details     │
│  4. You get notified via email/WhatsApp              │
│  5. You contact them to arrange payment              │
│                                                       │
│  [Learn More] [Go to Dashboard]                      │
└──────────────────────────────────────────────────────┘
```

**Video Tutorial**:
- 2-minute walkthrough
- Shows AI in action
- Explains dashboard features
- Demonstrates taking over conversations

**Actions**:
- **[Watch Video]**: Opens video tutorial
- **[Go to Dashboard]**: Redirects to main dashboard
- Can also click "View Conversation" if message received

---

## Success Metrics

### Onboarding Funnel Metrics

**Step-by-Step Completion**:

| Step | Target Completion | Avg Time | Drop-off Threshold |
|------|------------------|----------|-------------------|
| 0. Sign Up | 100% | 30s | - |
| 1. Business Setup | 95% | 1min | Alert if <90% |
| 2. Channel Connection | 85% | 3min | Alert if <80% |
| 3. Add Products | 85% | 4min | Alert if <80% |
| 4. AI Customize | 95% | 2min | Alert if <90% |
| 5. Go Live | 100% | 30s | - |
| **Overall** | **80%+** | **<10min** | **Alert if <75%** |

**Key Metrics to Track**:

1. **Completion Rate**: % who complete all 5 steps
2. **Time to Complete**: Average time from signup to go-live
3. **Step Drop-off**: Where users abandon onboarding
4. **Time to First Order**: Hours from setup to first captured order
5. **Support Tickets**: # related to onboarding issues

**Success Targets**:
- 80%+ complete onboarding
- <10 minutes average completion time
- <5% support tickets related to setup confusion
- First order captured within 24 hours for 60% of users

### User Behavior Signals

**Positive Signals**:
- Completes setup in one session (no exits/returns)
- Tests AI immediately after setup
- Adds 3+ products
- Connects both Instagram and Facebook
- Receives first order within 24 hours

**Warning Signals**:
- Abandons during channel connection
- Only adds 1 product
- Doesn't test AI
- Multiple support tickets
- No activity after setup

**Intervention Points**:
- Abandoned at Step 2: Email with help connecting channels
- Abandoned at Step 3: Email with product CSV template
- No activity 24h after setup: Email encouraging first test
- No orders after 7 days: Email with marketing tips

---

**Document Status**: Draft v1.0
**Last Updated**: 2026-01-11
**Next Review**: After user testing
**Owner**: Product Team
