# Beauty AI DM Assistant - Product Discovery & Specification

---

## Document Purpose

This document provides a detailed product specification from a discovery perspective, breaking down user needs, journeys, features, and interactions required to build the Beauty AI DM Assistant. It focuses on what the product does and how users interact with it, not how it's technically implemented.

**Status**: Draft v1.0
**Date**: 2026-01-11
**Related Docs**:
- beauty-ai-assistant-prd.md
- onboarding-experience.md

---

## Table of Contents

1. [Product Vision & Flow](#product-vision--flow)
2. [User Accounts & Roles](#user-accounts--roles)
3. [Product Catalog Management](#product-catalog-management)
4. [Channel Connection & Management](#channel-connection--management)
5. [Conversational AI Behavior](#conversational-ai-behavior)
6. [Order Capture Journey](#order-capture-journey)
7. [Human Handoff Experience](#human-handoff-experience)
8. [Notification System](#notification-system)
9. [Dashboard & Administration](#dashboard--administration)
10. [Data & Information Architecture](#data--information-architecture)
11. [Safety, Compliance & Trust](#safety-compliance--trust)

**Note**: For detailed onboarding experience documentation, see [onboarding-experience.md](./onboarding-experience.md)

---

## Product Vision & Flow

### End-to-End System Flow

```
Customer Journey:
┌─────────────────────────────────────────────────────────────┐
│ Customer sends DM on Instagram/Facebook                      │
│   ↓                                                          │
│ AI responds instantly with product info                      │
│   ↓                                                          │
│ Customer shows buying intent                                 │
│   ↓                                                          │
│ AI collects order details one-by-one                         │
│   ↓                                                          │
│ AI confirms order summary                                    │
│   ↓                                                          │
│ AI hands off to shop owner                                   │
└─────────────────────────────────────────────────────────────┘

Seller Journey:
┌─────────────────────────────────────────────────────────────┐
│ Receives notification (email/WhatsApp/dashboard)             │
│   ↓                                                          │
│ Reviews order details & conversation history                 │
│   ↓                                                          │
│ Contacts customer directly on platform                       │
│   ↓                                                          │
│ Arranges payment & shipping manually                         │
│   ↓                                                          │
│ Marks order as complete                                      │
└─────────────────────────────────────────────────────────────┘
```

### Key Product Principles

1. **Simplicity First**: 10-minute setup from signup to first order
2. **One Thing at a Time**: Never overwhelm users with multiple questions
3. **Always Helpful, Never Harmful**: Beauty-safe responses, no medical claims
4. **Human-in-the-Loop**: AI captures, human completes
5. **Seller Control**: Can take over any conversation anytime

---

## User Accounts & Roles

### Account Types

**Free Trial Account**:
- 14 days access to all features
- No credit card required
- Full functionality (unlimited DMs, channels, products)
- Converts to paid or gets suspended after trial

**Paid Account** ($29/month):
- All features unlocked
- Unlimited DMs (fair use policy)
- Unlimited products
- Multiple channel connections
- Priority support

**Suspended Account**:
- Payment failed or trial expired
- Read-only access to data
- Can export orders and conversations
- Can reactivate by updating payment

**Cancelled Account**:
- Data retained for 30 days
- Can reactivate within 30 days
- After 30 days, all data permanently deleted

### User Profile Information

Each seller account includes:

**Business Details**:
- Business name (displayed to customers)
- Business type (Shop / Influencer / Other)
- Primary product category (Skincare / Makeup / Both)

**Regional Settings**:
- Timezone (affects operating hours)
- Currency (USD, EUR, VND, etc.)

**AI Personality**:
- Brand tone: Friendly / Luxe / Influencer
- Response speed: Instant / Delayed (1-3 seconds)
- Operating hours: Always on / Custom schedule

**Notification Preferences**:
- Email notifications (on/off, which email)
- WhatsApp notifications (on/off, phone number)
- Alert types (orders, new messages, weekly digest)
- Quiet hours (no notifications during set times)

### User Authentication Flows

**Sign Up Journey**:
1. Click "Start Free Trial" on landing page
2. Enter email and create password
3. Verify email (6-digit code sent)
4. Enter business information
5. Choose brand tone and preferences
6. Redirected to channel connection

**Login Journey**:
1. Enter email and password
2. Optional: 2FA code if enabled
3. Land on dashboard

**Password Reset Journey**:
1. Click "Forgot Password"
2. Enter email address
3. Receive reset link via email (valid 1 hour)
4. Click link, enter new password
5. Confirmation and redirect to login

---

## Product Catalog Management

### Product List View

**What the seller sees**:
```
┌──────────────────────────────────────────────────────────┐
│  Products (12)                      [+ Add Product]      │
├──────────────────────────────────────────────────────────┤
│  🔍 Search products...                    [Filters ▼]    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [📷]  Glow Serum                        $45.00    │ │
│  │       Brightening vitamin C serum                  │ │
│  │       Variants: 30ml ($45), 50ml ($55)             │ │
│  │       ● Available                                   │ │
│  │       [Edit] [Mark Out of Stock] [Delete]          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [📷]  Hydra Cream                       $55.00    │ │
│  │       Deep hydration moisturizer                   │ │
│  │       No variants                                   │ │
│  │       ○ Out of Stock                                │ │
│  │       [Edit] [Mark Available] [Delete]             │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ [📷]  Lip Tint Collection                $22.00   │ │
│  │       Long-lasting lip color                        │ │
│  │       Variants: 4 shades                            │ │
│  │       ● Available                                   │ │
│  │       [Edit] [Mark Out of Stock] [Delete]          │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### Product Management Features

**Adding a Product**:
1. Click "+ Add Product"
2. Fill in quick form (Name, Price minimum)
3. Optionally add: Description, Image, Variants
4. Click "Save Product"
5. Immediately available to AI

**Editing a Product**:
1. Click "Edit" on product card
2. Modal opens with all fields editable
3. Make changes
4. Click "Save" or "Cancel"
5. AI immediately uses updated information

**Availability Toggle**:
- One-click: "Mark Out of Stock" / "Mark Available"
- When out of stock: AI tells customers "Currently unavailable, but I'll let the owner know you're interested"
- Visual indicator: Green dot (available) vs Gray dot (out of stock)

**Deleting a Product**:
1. Click "Delete"
2. Confirmation dialog: "Are you sure? This cannot be undone."
3. If product has active orders: "Cannot delete - 3 active orders reference this product"
4. If safe to delete: Product removed (soft delete, kept in database)

### Bulk Operations

**Bulk Import via CSV**:
```
┌──────────────────────────────────────────────────────────┐
│  Import Products from CSV                                │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  1. Download our template CSV file                       │
│     [Download Template]                                   │
│                                                           │
│  2. Fill in your products                                │
│     - One row per product (or per variant)               │
│     - Required: name, price, currency                    │
│     - Optional: description, variants                    │
│                                                           │
│  3. Upload your file                                     │
│     [Choose File] or drag and drop here                  │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Preview (15 products found):                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │ ✓ Glow Serum - $45 - 2 variants                   │ │
│  │ ✓ Hydra Cream - $55 - No variants                 │ │
│  │ ✗ Error: Missing price for "Face Wash"            │ │
│  │ ✓ Lip Tint - $22 - 4 variants                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  Status: 14 valid, 1 error                               │
│                                                           │
│  [Fix Errors] [Import Valid Products] [Cancel]           │
└──────────────────────────────────────────────────────────┘
```

**Bulk Availability Management**:
1. Select multiple products (checkboxes)
2. Toolbar appears: "5 products selected"
3. Options: "Mark Available" / "Mark Out of Stock" / "Delete"
4. Confirmation for bulk actions
5. Success message: "5 products updated"

### Product Variants Management

**Variant Types**:
- **Size**: 30ml, 50ml, 100ml, etc.
- **Shade**: Light, Medium, Dark, or specific colors
- **Scent**: Rose, Lavender, Unscented, etc.
- **Custom**: Any other variant type

**How Variants Work**:
- Each variant has a name and price modifier
- Price modifier is added to base price
- Example: Base $45 + Variant modifier $10 = Total $55
- Variants can be individually marked available/unavailable
- AI asks customers to choose variant during order

**Managing Variants**:
```
┌──────────────────────────────────────────────────────────┐
│  Edit Product: Glow Serum                                │
├──────────────────────────────────────────────────────────┤
│  Base Price: $45                                         │
│                                                           │
│  Variants:                                                │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Size: 30ml                                         │ │
│  │ Price: $45 (base + $0)                            │ │
│  │ ● Available  [Edit] [Remove]                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Size: 50ml                                         │ │
│  │ Price: $55 (base + $10)                           │ │
│  │ ● Available  [Edit] [Remove]                       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  [+ Add Variant]                                         │
│                                                           │
│  [Save] [Cancel]                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Channel Connection & Management

### Supported Channels (MVP)

1. **Instagram Direct Messages** (Business accounts only)
2. **Facebook Messenger** (Pages only)

### Channel Management Dashboard

**What the seller sees**:
```
┌──────────────────────────────────────────────────────────┐
│  Connected Channels (2)              [+ Connect Channel] │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Instagram                                         │ │
│  │  @my_beauty_shop                                   │ │
│  │  ✅ Active • 145 messages today                    │ │
│  │  Connected 14 days ago                             │ │
│  │                                                     │ │
│  │  [View Statistics] [Reconnect] [Disconnect]        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Facebook Page                                     │ │
│  │  My Beauty Shop                                    │ │
│  │  ✅ Active • 89 messages today                     │ │
│  │  Connected 14 days ago                             │ │
│  │                                                     │ │
│  │  [View Statistics] [Reconnect] [Disconnect]        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### Channel Health Monitoring

**Status Indicators**:
- ✅ **Active**: Connected, working normally
- ⚠️ **Warning**: Token expiring soon, needs reconnection
- ❌ **Disconnected**: Connection lost, immediate action required
- ⏸️ **Paused**: User manually paused AI

**Health Check Notifications**:
- Email alert if channel disconnects
- Dashboard notification if token expiring (7 days before)
- Weekly health summary report

**Channel Statistics**:
```
┌──────────────────────────────────────────────────────────┐
│  Instagram @my_beauty_shop - Statistics                  │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Last 7 days:                                            │
│  • Total messages: 342                                   │
│  • Conversations: 89                                     │
│  • Orders captured: 23                                   │
│  • Average response time: <2 seconds                     │
│  • AI handled: 95% (85 conversations)                    │
│  • Human takeover: 5% (4 conversations)                  │
│                                                           │
│  Top products asked about:                               │
│  1. Glow Serum (34 inquiries)                           │
│  2. Hydra Cream (28 inquiries)                          │
│  3. Lip Tint (19 inquiries)                             │
│                                                           │
│  [View Detailed Report] [Export Data]                    │
└──────────────────────────────────────────────────────────┘
```

### Disconnecting & Reconnecting

**Disconnect Flow**:
1. Click "Disconnect"
2. Warning: "AI will stop responding on this channel. Continue?"
3. Confirm
4. Channel marked inactive
5. Can reconnect anytime with same button

**Reconnect Flow** (when token expired):
1. Dashboard shows "⚠️ Reconnection needed"
2. Click "Reconnect"
3. Re-do OAuth flow
4. Success: "✅ Channel reconnected"

**Platform Policy Compliance**:
- 24-hour messaging window (can't message first after 24h of customer's last message)
- No spam or bulk messaging
- Respect user blocking/reporting
- Clear that it's an automated assistant

---

## Conversational AI Behavior

### AI Personality & Capabilities

**What the AI Can Do**:
1. Answer product questions (price, description, availability)
2. Understand buying intent and start order collection
3. Collect order details one field at a time
4. Remember conversation context
5. Match brand tone (friendly/luxe/influencer)
6. Detect when to hand off to human

**What the AI Cannot Do**:
1. Make medical claims or give health advice
2. Guarantee results or outcomes
3. Process payments
4. Create custom products
5. Make decisions outside its training
6. Have opinions or preferences

### Conversation Intent Types

The AI recognizes these customer intents:

**Greeting**:
- Customer: "Hi", "Hello", "Hey there"
- AI Response: Greeting based on brand tone
- Next: Wait for customer to state need

**Product Inquiry**:
- Customer: "What does the serum do?", "Tell me about the cream"
- AI Response: Describe product benefits (no medical claims)
- Next: Ask if they want to know more or order

**Price Check**:
- Customer: "How much is X?", "Price of Y?"
- AI Response: State price clearly, mention variants if applicable
- Next: Ask if they'd like to order

**Availability Check**:
- Customer: "Is X in stock?", "Do you have Y?"
- AI Response: "Yes, available!" or "Currently out of stock"
- Next: If available, ask if they want to order

**Buying Intent**:
- Customer: "I want to buy", "Can I order", "I'll take one"
- AI Response: Confirm which product, start order collection
- Next: Begin order capture flow

**Complaint**:
- Customer: "This is terrible", "I'm unhappy", angry tone
- AI Response: Apologize, immediately hand off to owner
- Next: Human takes over

**Medical Question**:
- Customer: "Will this cure my acne?", "Is this safe for eczema?"
- AI Response: "Great question! Let me connect you with the owner"
- Next: Immediate handoff (safety critical)

**Custom Request**:
- Customer: "Can you make this in blue?", "Special packaging?"
- AI Response: "Let me check with the owner about that"
- Next: Handoff to owner

**Chit Chat**:
- Customer: "How are you?", "What's your name?"
- AI Response: Brief, friendly response, redirect to products
- Next: "How can I help with your beauty needs?"

### Conversation Context & Memory

**What the AI Remembers**:
- Previous messages in current conversation (last 24 hours)
- Products mentioned
- Buying intent signals
- Current conversation state (browsing, ordering, etc.)
- Partially collected order information

**What the AI Forgets**:
- Conversations after 24 hours of inactivity
- Information from different customers
- Personal data not needed for order

**Context Examples**:

Example 1 - Following up on interest:
```
Customer: "How much is the serum?"
AI: "The Glow Serum is $45! Want to order?"
Customer: "Maybe later"
AI: "No problem! Let me know if you have questions."
[2 hours later]
Customer: "Actually yes, I want it"
AI: "Great! Let's get your order for the Glow Serum sorted..."
```

Example 2 - Remembering variant preference:
```
Customer: "Do you have the 50ml size?"
AI: "Yes! The Glow Serum in 50ml is $55. Want to order?"
Customer: "Yes"
AI: "Perfect! How many 50ml bottles would you like?"
[AI remembers they want 50ml variant]
```

### Response Generation by Brand Tone

**Friendly Tone**:
- Characteristics: Warm, casual, helpful, emoji-friendly
- Greeting: "Hey! 😊 How can I help you today?"
- Price response: "The Glow Serum is $45! It's amazing for brightening. Want one?"
- Order start: "Awesome! Let's get your order sorted 💕"
- Handoff: "Thanks so much! The owner will message you soon to arrange payment!"

**Luxe Tone**:
- Characteristics: Premium, sophisticated, professional
- Greeting: "Good day. How may I assist you with your beauty needs?"
- Price response: "The Glow Serum is priced at $45. Would you like to place an order?"
- Order start: "Excellent choice. Let me collect the details for your order."
- Handoff: "Thank you for your order. The owner will contact you shortly to finalize the details."

**Influencer Tone**:
- Characteristics: Personal, enthusiastic, relatable
- Greeting: "Omg hiiii! 💕 What are you looking for today?"
- Price response: "The Glow Serum is $45! It's literally my fave 😍 Want one??"
- Order start: "Yayyy! Let me get your deets!"
- Handoff: "Omg yay! 🎉 The owner will DM you soon about payment and shipping!"

### Safety Guardrails

**Medical Claims Prevention**:
- Blocked words: "cure", "treat", "heal", "fix", "eliminate"
- AI never says: "This will fix your acne"
- AI can say: "This serum contains vitamin C, known for brightening"

**Example Safe vs Unsafe Responses**:
```
Customer: "Will this cure my acne?"

❌ Unsafe: "Yes, it will cure your acne in 2 weeks!"
✅ Safe: "Great question! Let me connect you with the owner who can help with that."

Customer: "What's in this serum?"

❌ Unsafe: "It has retinol which treats wrinkles"
✅ Safe: "It contains vitamin C, hyaluronic acid, and niacinamide for brightening and hydration."
```

**Escalation Triggers**:
- Medical/health questions → Immediate handoff
- Negative sentiment → Handoff
- Custom requests → Handoff
- Low confidence (<50%) → Handoff
- Explicit request for human → Handoff

---

## Order Capture Journey

### Order Capture Flow Overview

```
State Machine:

BROWSING
  ↓ (Buying intent detected)
COLLECTING_PRODUCT
  ↓ (Product identified)
COLLECTING_VARIANT (if product has variants)
  ↓ (Variant selected)
COLLECTING_QUANTITY
  ↓ (Quantity provided)
COLLECTING_LOCATION
  ↓ (Location provided)
CONFIRMING_ORDER
  ↓ (Confirmed)
ORDER_CAPTURED
  ↓
HANDED_OFF
```

### Detailed Conversation Examples

**Example 1: Simple Order (No Variants)**

```
Customer: "I want the Hydra Cream"
AI: "Great choice! The Hydra Cream is $55. How many would you like?"

Customer: "2"
AI: "Perfect! 2 bottles. Where should we ship them? (City/Country)"

Customer: "Sydney"
AI: "Let me confirm your order:
     • Hydra Cream × 2
     • Total: $110
     • Shipping to: Sydney

     Is this correct?"

Customer: "Yes"
AI: "Perfect! The owner will message you soon to arrange payment and delivery. Thank you! 💖"

[Order captured, seller notified]
```

**Example 2: Order with Variants**

```
Customer: "Can I get the Glow Serum?"
AI: "Absolutely! The Glow Serum comes in:
     • 30ml ($45)
     • 50ml ($55)

     Which size would you like?"

Customer: "50ml"
AI: "Great! How many 50ml bottles?"

Customer: "1"
AI: "Perfect! Where should we ship it?"

Customer: "Melbourne, Australia"
AI: "Let me confirm:
     • Glow Serum (50ml) × 1
     • Total: $55
     • Shipping to: Melbourne, Australia

     Is this correct?"

Customer: "Yes"
AI: "Awesome! The owner will message you shortly about payment. Thanks! 🎉"
```

**Example 3: Order Correction**

```
[... order collection happens ...]

AI: "Let me confirm:
     • Glow Serum (30ml) × 2
     • Total: $90
     • Shipping to: Sydney

     Is this correct?"

Customer: "No, I want 50ml not 30ml"
AI: "No problem! Let me update that:
     • Glow Serum (50ml) × 2
     • Total: $110
     • Shipping to: Sydney

     Is this better?"

Customer: "Yes perfect"
AI: "Great! The owner will contact you soon!"
```

### Order Collection Rules

**One Question at a Time**:
- Never ask multiple questions in one message
- Wait for customer response before next question
- Keep questions simple and clear

**Question Sequence**:
1. Which product? (if not already mentioned)
2. Which variant? (if product has variants)
3. How many?
4. Where to ship?
5. Confirm all details

**Validation & Error Handling**:

**Product Selection**:
- If unclear: "Which product did you mean? We have: [list 3-5 products]"
- If not found: "I don't think we have that. Want to see our products?"
- If out of stock: "That's currently unavailable. Can I suggest something similar?"

**Variant Selection**:
- If unclear: "Which [variant type]? We have: [list options]"
- If invalid: "We have [list valid variants]. Which would you prefer?"

**Quantity**:
- If not a number: "How many would you like? (Please enter a number)"
- If too high (>100): "That's a lot! Let me connect you with the owner for bulk orders."
- If zero/negative: "Please enter a number greater than 0"

**Location**:
- If too short (<2 chars): "Could you provide your city or country?"
- If empty: "Where should we ship it?"
- Accept any text (city, country, full address)

**Confirmation**:
- If "yes/yeah/yep/correct/ok": Proceed to capture
- If "no/nope/wrong": "What would you like to change?"
- If unclear: "Is this order correct? (Yes/No)"

### Order Summary Format

The AI generates a clear summary before final confirmation:

**Format** (adapted to brand tone):
```
Let me confirm your order:
• [Product Name] ([Variant]) × [Quantity]
• Total: $[Amount]
• Shipping to: [Location]

Is this correct?
```

**Friendly Tone Example**:
```
Let me confirm your order:
• Glow Serum (50ml) × 2
• Total: $110
• Shipping to: Sydney

Is this correct? 😊
```

**Luxe Tone Example**:
```
Order Summary:
Glow Serum (50ml) × 2
Subtotal: $110
Destination: Sydney

Please confirm if the details are correct.
```

**Influencer Tone Example**:
```
Okay so you want:
Glow Serum (50ml) × 2 = $110 💕
Shipping to Sydney

Right?? 😍
```

### What Happens After Order Captured

**Immediate Actions**:
1. AI sends confirmation to customer
2. AI disables itself for this conversation
3. System creates order record
4. Seller receives notifications (email, WhatsApp, dashboard)
5. Conversation marked as "handed off"

**Customer Experience**:
- Clear expectation: "Owner will contact you soon"
- No more AI responses in this conversation
- Next message from seller is human

**Seller Experience**:
- Instant notification with order summary
- Full conversation history
- Customer contact information
- Action buttons: Contact, Mark Complete, Cancel

---

## Human Handoff Experience

### When Handoff Happens

**Automatic Handoff Triggers**:

1. **Order Confirmed** (always):
   - AI collected all details
   - Customer confirmed order
   - Seller needs to handle payment

2. **Medical/Health Question**:
   - Customer asks about skin conditions
   - Questions about allergies, reactions
   - Any medical terminology detected

3. **Custom/Special Request**:
   - Custom product modifications
   - Special packaging requests
   - Bulk or wholesale inquiries

4. **Negative Sentiment/Complaint**:
   - Customer expresses dissatisfaction
   - Complaint about product or service
   - Angry or frustrated tone

5. **Low AI Confidence**:
   - AI doesn't understand question
   - Ambiguous request
   - Outside AI's knowledge

6. **Explicit Request**:
   - Customer asks to speak to human/owner
   - "Let me talk to a real person"

**Manual Handoff**:
- Seller can take over any conversation anytime from dashboard
- Click "Take Over" button
- AI immediately stops responding

### Customer Experience During Handoff

**What Customer Sees** (adapted to brand tone):

**Friendly**:
```
"Thanks so much! 💕 The owner will message you shortly to arrange payment and delivery!"
```

**Luxe**:
```
"Thank you for your order. The owner will contact you shortly to finalize the details."
```

**Influencer**:
```
"Omg yay! 🎉 The owner will DM you soon to sort out payment and shipping!"
```

**After Handoff**:
- No more automated responses
- Next message is from seller (human)
- Conversation continues naturally
- No indication it was ever a bot (unless customer asks)

### Seller Notification & Alert System

**Notification Content**:

**Email Subject**: "New Order Captured 🎉"

**Email Body**:
```
Hi My Beauty Shop,

Great news! Your AI assistant captured a new order:

ORDER DETAILS:
━━━━━━━━━━━━━━━━━━━
Product: Glow Serum (50ml)
Quantity: 2
Total: $110
Shipping: Sydney, Australia
━━━━━━━━━━━━━━━━━━━

CUSTOMER INFO:
Platform: Instagram
Username: @customer_username
Profile: [Link to Instagram profile]

CONVERSATION SUMMARY:
"Customer asked about the serum price, showed interest in the 50ml size, and confirmed order for delivery to Sydney."

[View Full Conversation] [Contact Customer] [Mark Complete]

Next steps:
1. Contact the customer on Instagram to arrange payment
2. Confirm shipping details and timeline
3. Mark order as complete once fulfilled

View in Dashboard: [Dashboard Link]

—
Beauty AI Assistant
```

**WhatsApp Notification**:
```
🎉 New Order!

Product: Glow Serum (50ml) × 2
Total: $110
Ship to: Sydney

[View] [Contact]
```

**Dashboard Alert**:
- Toast notification (top-right corner)
- Sound/vibration (if enabled)
- Red badge on "Orders" tab showing count
- Real-time update to orders list

**Notification Timing**:
- Email: Sent immediately (within 10 seconds)
- WhatsApp: Sent immediately if enabled
- Dashboard: Real-time (instant)
- Batching: If multiple orders in 5 minutes, send summary

### Conversation Takeover Interface

**Dashboard View**:
```
┌──────────────────────────────────────────────────────────┐
│  Conversation with @customer_username                     │
│  Platform: Instagram   Status: 🤖 AI Handling            │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Full Chat History:                                       │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Customer (2:14 PM)                                 │ │
│  │ How much is the glow serum?                        │ │
│  │                                                     │ │
│  │ AI Bot (2:14 PM)                                   │ │
│  │ The Glow Serum is $45! It comes in 30ml and 50ml. │ │
│  │ Want to order? 😊                                  │ │
│  │                                                     │ │
│  │ Customer (2:15 PM)                                 │ │
│  │ Yes, 50ml please                                   │ │
│  │                                                     │ │
│  │ AI Bot (2:15 PM)                                   │ │
│  │ Great! How many 50ml bottles?                      │ │
│  │                                                     │ │
│  │ Customer (2:15 PM)                                 │ │
│  │ 2                                                   │ │
│  │                                                     │ │
│  │ AI Bot (2:15 PM)                                   │ │
│  │ Perfect! Where should we ship them?                │ │
│  │                                                     │ │
│  │ Customer (2:16 PM)                                 │ │
│  │ Sydney                                              │ │
│  │                                                     │ │
│  │ AI Bot (2:16 PM)                                   │ │
│  │ Let me confirm:                                     │ │
│  │ • Glow Serum (50ml) × 2                           │ │
│  │ • Total: $110                                      │ │
│  │ • Shipping to: Sydney                              │ │
│  │ Is this correct? 😊                                │ │
│  │                                                     │ │
│  │ Customer (2:16 PM)                                 │ │
│  │ Yes!                                                │ │
│  │                                                     │ │
│  │ AI Bot (2:16 PM)                                   │ │
│  │ Perfect! The owner will message you soon! 💖       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  [🙋 Take Over Conversation]                             │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Your message:                                            │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Type your message to the customer...               │ │
│  │                                                     │ │
│  │                                                     │ │
│  └────────────────────────────────────────────────────┘ │
│  [Send Message]                                           │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Takeover Actions**:
1. Click "Take Over Conversation"
2. AI immediately stops for this conversation
3. Type message in text box
4. Click "Send Message"
5. Message sent directly from seller's account
6. Conversation continues as human-to-human

**Quick Actions**:
- "Contact on Instagram" - Opens Instagram DM in new tab
- "Contact on Facebook" - Opens Messenger in new tab
- "Copy order details" - Copies summary to clipboard
- "Add note" - Add internal notes about customer

---

## Notification System

### Notification Types

**1. Order Captured** (High Priority):
- When: AI successfully captures an order
- Channels: Email, WhatsApp, Dashboard, Push
- Content: Order details, customer info, conversation link
- Action required: Contact customer for payment

**2. New Message** (Medium Priority):
- When: Customer sends message (only if not handled by AI)
- Channels: Email (batched), Dashboard
- Content: Message preview, customer name
- Action: Optional - review or let AI handle

**3. Customer Waiting** (Medium Priority):
- When: No response to customer in 1+ hour (human takeover scenario)
- Channels: Email, Dashboard
- Content: Reminder with last message
- Action: Respond to customer

**4. Channel Disconnected** (High Priority):
- When: Instagram/Facebook connection fails
- Channels: Email, Dashboard
- Content: Which channel, reconnection link
- Action required: Reconnect immediately

**5. Weekly Summary** (Low Priority):
- When: Every Monday morning
- Channels: Email only
- Content: Orders captured, top products, engagement stats
- Action: None - informational

### Notification Preferences

**User Controls**:
```
┌──────────────────────────────────────────────────────────┐
│  Notification Settings                                    │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Email Notifications                                      │
│  [✓] Enable email notifications                          │
│  Email address: shop@example.com                         │
│                                                           │
│  Notify me about:                                         │
│  [✓] New orders (High priority)                          │
│  [✓] New messages (Batched every 5 minutes)              │
│  [ ] Every single message (Not recommended)              │
│  [✓] Channel health issues                               │
│  [✓] Weekly summary                                      │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  WhatsApp Notifications                                   │
│  [✓] Enable WhatsApp notifications                       │
│  Phone number: +84 912 345 678                           │
│                                                           │
│  Notify me about:                                         │
│  [✓] New orders                                          │
│  [ ] New messages                                         │
│  [ ] Channel issues                                       │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Quiet Hours                                              │
│  [✓] Enable quiet hours (no notifications during)        │
│  From: 22:00  To: 08:00  Timezone: Asia/Ho_Chi_Minh     │
│                                                           │
│  [Save Preferences]                                       │
└──────────────────────────────────────────────────────────┘
```

### Notification Batching

**Problem**: If 50 customers message within 5 minutes, seller gets 50 emails

**Solution**: Smart batching
- High priority (orders): Always immediate, never batched
- Medium priority (messages): Batch if multiple within 5 minutes
- Low priority (summaries): Weekly only

**Batched Notification Example**:
```
Subject: 5 new customer messages

Hi My Beauty Shop,

You have 5 new messages from customers:

1. @customer1 - "Do you have this in blue?" (2 min ago)
2. @customer2 - "Thanks!" (3 min ago)
3. @customer3 - "How long for shipping?" (4 min ago)
4. @customer4 - "Is this vegan?" (4 min ago)
5. @customer5 - "Price?" (5 min ago)

Note: Your AI is handling these conversations automatically.

[View All Conversations]
```

---

## Dashboard & Administration

### Dashboard Home

**Overview Screen**:
```
┌──────────────────────────────────────────────────────────┐
│  Welcome back, My Beauty Shop!                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Today's Activity:                                        │
│  ┌────────────┬────────────┬────────────┬────────────┐  │
│  │  Messages  │   Orders   │ AI Handled │  Response  │  │
│  │    145     │     12     │    98%     │   <2 sec   │  │
│  └────────────┴────────────┴────────────┴────────────┘  │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Recent Orders (3 pending)              [View All →]     │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🆕 @customer1 • Glow Serum × 1 • $45 • Sydney     │ │
│  │    2 minutes ago • [Contact] [View]                │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🆕 @customer2 • Hydra Cream × 2 • $110 • Melbourne│ │
│  │    15 minutes ago • [Contact] [View]               │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  Active Conversations (4)               [View All →]     │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🤖 @customer3 asking about product ingredients     │ │
│  │    AI handling • [View] [Take Over]                │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                           │
│  System Health:                                           │
│  ✅ Instagram: Active (145 msgs today)                   │
│  ✅ Facebook: Active (89 msgs today)                     │
│  ✅ AI Assistant: Running smoothly                       │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### Orders Management

(Already covered in detail above - see Order Detail View in Handoff section)

**Key Features**:
- List all orders with filters (status, date, platform)
- Search by customer name or product
- Sort by date, amount, status
- Bulk actions (mark multiple as complete)
- Export to CSV for accounting

**Order Statuses**:
- **Captured**: New order, awaiting seller action
- **In Progress**: Seller contacted customer
- **Completed**: Order fulfilled
- **Cancelled**: Order cancelled by seller or customer

### Conversations Management

**Active Conversations View**:
```
┌──────────────────────────────────────────────────────────┐
│  Conversations (8 active)                                │
│  [All] [AI Handling] [Human Taken Over] [Ended]         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🤖 @customer_name                    2 min ago     │ │
│  │    Instagram • AI: "Where should we ship it?"      │ │
│  │    [View Conversation] [Take Over]                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 👤 @another_customer                 1 hour ago    │ │
│  │    Facebook • You: "I'll send tracking tomorrow"   │ │
│  │    [View Conversation] [Reply]                     │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
│  ┌────────────────────────────────────────────────────┐ │
│  │ 🤖 @user123                          5 min ago     │ │
│  │    Instagram • AI answering product questions      │ │
│  │    [View Conversation] [Take Over]                 │ │
│  └────────────────────────────────────────────────────┘ │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

**Indicators**:
- 🤖 = AI currently handling
- 👤 = Human (seller) taken over
- ⏸️ = Conversation ended (no activity 24h+)
- 🆕 = New conversation (first message)

**Filters**:
- All conversations
- AI handling only
- Human taken over only
- Ended conversations
- By platform (Instagram/Facebook)
- By date range

### Settings & Configuration

**Settings Sections**:

**1. Business Settings**:
- Business name, type, products category
- Timezone, currency
- Edit anytime

**2. AI Assistant Settings**:
- Brand tone (Friendly/Luxe/Influencer) with previews
- Auto-handoff triggers (checkboxes)
- Response speed (Instant/Delayed)
- Operating hours (24/7 or custom schedule)

**3. Notification Settings**:
(Already detailed above in Notification Preferences)

**4. Account & Billing**:
- Email and password change
- Subscription status and renewal date
- Payment method
- Billing history
- Upgrade/downgrade plan
- Cancel subscription

**5. Data & Privacy**:
- Export all data (orders, conversations, products) as CSV
- Data retention settings
- Delete account (with confirmation)

---

## Data & Information Architecture

### Core Data Entities

**User/Seller**:
- Account information (email, password)
- Business profile (name, type, settings)
- Subscription details (status, expiry)
- Notification preferences

**Product**:
- Basic info (name, price, description, image)
- Variants (type, name, price modifier, availability)
- Availability status
- Creation and update timestamps

**Channel**:
- Platform type (Instagram/Facebook)
- Account details (ID, username, name)
- Connection status (active/inactive)
- Access credentials (encrypted)
- Last activity timestamp

**Conversation**:
- Customer identifier
- Channel reference
- Current state (browsing, collecting, handed off)
- AI enabled/disabled
- Conversation history
- Timestamps (created, updated, handed off)

**Message**:
- Sender (customer/AI/seller)
- Message text
- Detected intent
- Extracted entities (products, quantities, etc.)
- Timestamp

**Order**:
- Customer details
- Product snapshot (name, price at time of order)
- Variant snapshot (if applicable)
- Quantity and total price
- Shipping location
- Status (captured, in progress, completed, cancelled)
- Conversation reference
- Seller notes
- Timestamps (captured, handed off, completed)

### Data Relationships

```
User (Seller)
  ├── has many → Channels
  ├── has many → Products
  │   └── has many → Product Variants
  ├── has many → Conversations
  │   └── has many → Messages
  └── has many → Orders
      └── belongs to → Conversation
      └── references → Product
      └── references → Product Variant
```

### Data Retention

**Active Data** (user has active subscription):
- All data retained indefinitely
- Conversations: Full history
- Orders: Full history
- Messages: Full history

**Cancelled/Suspended Account**:
- Retain for 30 days
- Read-only access for export
- After 30 days: Permanent deletion

**Conversation History**:
- Active conversations: 24 hours context
- Archived conversations: 90 days retention
- After 90 days: Summarized only (not full messages)

**Order History**:
- Retained indefinitely (for accounting)
- Can export anytime

### Data Export

**What Users Can Export**:
- All products (CSV)
- All orders with conversation summaries (CSV)
- All conversation transcripts (JSON/CSV)
- Customer contact information (CSV)

**Export Format Example** (Orders CSV):
```
Order ID, Date, Customer, Platform, Product, Variant, Quantity, Price, Total, Shipping, Status
ORD001, 2026-01-11 14:23, @customer1, Instagram, Glow Serum, 50ml, 2, 55, 110, Sydney, Captured
ORD002, 2026-01-11 15:45, @customer2, Facebook, Hydra Cream, , 1, 55, 55, Melbourne, Completed
```

---

## Safety, Compliance & Trust

### Safety Guardrails

**Beauty Industry Compliance**:
- No medical claims whatsoever
- No guarantee of results
- No diagnosis or treatment advice
- Ingredient information only (factual)
- Age-appropriate language

**Example Guardrails in Action**:

❌ **Not Allowed**:
- "This will cure your acne"
- "Guaranteed to remove wrinkles"
- "Treats eczema"
- "FDA approved for skin conditions"
- "You should use this for your rash"

✅ **Allowed**:
- "Contains vitamin C, which is known for brightening"
- "This serum has hyaluronic acid for hydration"
- "Popular for daily skincare routines"
- "Let me connect you with the owner for specific skin questions"

### Platform Compliance

**Meta Platform Policies**:
- 24-hour messaging window enforcement
- No unsolicited messages
- Respect user blocks/reports
- Clear that it's an automated assistant
- No spam or bulk messaging
- Privacy policy visible to customers

**Disclosure Requirements**:
- Landing page: "We use AI to respond to messages"
- Terms of service link
- Privacy policy link
- Contact information for support

### Data Privacy (GDPR/CCPA)

**User Rights**:
- Right to access: Export all data anytime
- Right to delete: Account deletion with 30-day window
- Right to portability: CSV/JSON export
- Right to be forgotten: Full deletion after 30 days

**Data Protection**:
- All data encrypted at rest
- Secure transmission (HTTPS)
- No selling of customer data
- No sharing with third parties (except Meta for platform functionality)
- Clear privacy policy

**Cookie Consent**:
- Banner on first visit
- Essential cookies only (authentication)
- Analytics opt-in required
- Preferences saved

### Security Measures

**Authentication**:
- Password requirements: 8+ chars, mixed case, number
- Email verification required
- Optional: Two-factor authentication
- Session timeout after 7 days

**Access Control**:
- Sellers can only access their own data
- Customers identified by platform ID
- No cross-contamination between shops

**Payment Security**:
- ⚠️ **Critical**: We NEVER handle payments
- No credit card information ever stored
- No payment processing on platform
- Seller handles payment externally (bank transfer, PayPal, etc.)

### Trust & Transparency

**To Customers**:
- AI identifies as assistant, not human
- Clear handoff: "The owner will message you"
- Conversation history visible to them
- Can request human anytime

**To Sellers**:
- Full transparency on AI actions
- All conversations logged
- Can review AI responses anytime
- Can take over any conversation
- Can provide feedback on AI behavior

**Customer Support**:
- Help documentation for sellers
- Email support for issues
- Community forum (future)
- Response time: 24 hours for support tickets

---

## Success Metrics & KPIs

### Product Success Indicators

**Onboarding Success**:
- % of users completing setup (target: 80%+)
- Time to first order captured (target: <24 hours after setup)
- Drop-off points in onboarding flow

**Core Product Performance**:
- Order capture rate: % of buying intents that become captured orders
- AI handle rate: % of conversations handled without human intervention
- Average response time: Speed of AI responses (target: <2 seconds)
- Channel uptime: % time channels are active and connected

**User Engagement**:
- Daily active sellers (checking dashboard)
- Orders per seller per week
- Conversion rate: trial to paid
- Retention rate: 7-day, 30-day

**Customer (End-User) Experience**:
- Conversation completion rate: % of started conversations that reach resolution
- Average conversation length: Number of messages to capture order
- Handoff rate: % of conversations requiring human intervention
- Time to seller response after handoff

### North Star Metric

**Orders Captured per Day** (across all sellers)
- Measures core value: AI capturing orders automatically
- Target MVP: 50+ orders/day across 100 sellers = 0.5 orders per seller per day
- Target Year 1: 1000+ orders/day across 1000 sellers = 1 order per seller per day

---

**Document Status**: Draft v1.0
**Last Updated**: 2026-01-11
**Next Steps**: Review with team, validate user flows with testing, begin MVP development
**Owner**: Product Team
