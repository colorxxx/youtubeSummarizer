# YouTube Summary Mailer

A web application that helps you stay updated with YouTube content through AI-generated summaries delivered via email.

## Features

- **User Authentication**: Secure login/logout functionality using Manus OAuth
- **YouTube Channel Management**: Search, subscribe, and manage your favorite YouTube channels
- **AI-Powered Summaries**: Automatic video content summarization using advanced LLM technology
- **Email Notifications**: Receive daily or weekly email digests with video summaries
- **Dashboard**: View subscription statistics and summary history
- **Settings**: Configure email preferences and delivery frequency

## Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Wouter (routing)
- **Backend**: Express 4, tRPC 11, Node.js
- **Database**: MySQL/TiDB with Drizzle ORM
- **AI**: Built-in LLM integration for video summarization
- **External APIs**: YouTube Data API v3

## Getting Started

### Prerequisites

- Node.js 22.x
- pnpm package manager
- YouTube Data API key (obtain from [Google Cloud Console](https://console.cloud.google.com/apis/credentials))

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Set up environment variables (YouTube API key is required)

4. Run database migrations:
   ```bash
   pnpm db:push
   ```

5. Start the development server:
   ```bash
   pnpm dev
   ```

The application will be available at `http://localhost:3000`

## Usage

### For Users

1. **Sign In**: Click "Sign In" to authenticate with your account
2. **Add Channels**: Navigate to "Subscriptions" and search for YouTube channels to follow
3. **Configure Settings**: Go to "Settings" to set your email address and delivery preferences
4. **View Summaries**: Check the "Summaries" page to see AI-generated summaries of recent videos

### Email Summaries

The system automatically:
- Fetches new videos from your subscribed channels
- Generates concise AI summaries highlighting key points
- Sends email digests based on your chosen frequency (daily or weekly)

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   └── lib/           # tRPC client setup
├── server/                # Backend Express + tRPC
│   ├── routers.ts         # API endpoints
│   ├── db.ts              # Database queries
│   ├── youtube.ts         # YouTube API integration
│   ├── summarizer.ts      # AI summarization logic
│   ├── mailer.ts          # Email sending
│   └── scheduler.ts       # Background job scheduling
├── drizzle/               # Database schema and migrations
└── shared/                # Shared types and constants
```

## API Endpoints

All endpoints are accessed via tRPC:

- `subscriptions.list` - Get user's subscriptions
- `subscriptions.add` - Subscribe to a channel
- `subscriptions.remove` - Unsubscribe from a channel
- `youtube.searchChannels` - Search for YouTube channels
- `videos.recent` - Get recent videos from subscribed channels
- `summaries.list` - Get user's video summaries
- `settings.get` - Get user settings
- `settings.update` - Update email preferences

## Testing

Run the test suite:

```bash
pnpm test
```

Tests cover:
- YouTube API integration
- Subscription management
- User settings
- Authentication flows

## Deployment

1. Ensure all tests pass
2. Create a checkpoint:
   ```bash
   # This is handled through the Manus platform UI
   ```
3. Click "Publish" in the Management UI

## Future Enhancements

- Integration with actual email service (SendGrid, Resend, etc.)
- Video transcript extraction for more accurate summaries
- Support for custom summary templates
- Scheduled job automation for daily processing
- Rate limiting and quota management for YouTube API

## Notes

- The current email implementation is a placeholder and logs to console
- YouTube API has daily quota limits - monitor usage in Google Cloud Console
- AI summaries are generated using the built-in LLM service

## License

MIT
