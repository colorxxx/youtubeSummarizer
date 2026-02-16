# YouTube Summary Mailer - TODO

## Phase 1: Database Schema
- [x] Create subscriptions table (userId, channelId, channelName, channelThumbnail, addedAt)
- [x] Create videos table (videoId, channelId, title, description, publishedAt, thumbnailUrl, duration)
- [x] Create summaries table (videoId, userId, summary, createdAt)
- [x] Create user_settings table (userId, emailEnabled, summaryFrequency, lastEmailSent)
- [x] Run database migration

## Phase 2: Backend API - YouTube Integration
- [x] Create YouTube Data API integration helper
- [x] Implement channel search endpoint
- [x] Implement add subscription endpoint
- [x] Implement remove subscription endpoint
- [x] Implement list subscriptions endpoint
- [x] Implement fetch new videos from subscribed channels

## Phase 3: Backend API - AI Summary & Email
- [x] Create LLM-based video summarization function
- [x] Create email template for daily summaries
- [x] Implement send summary email endpoint
- [x] Create scheduled job for daily video fetching and summarization
- [x] Implement user settings CRUD endpoints

## Phase 4: Frontend UI
- [x] Design color palette and typography
- [x] Create dashboard layout with sidebar navigation
- [x] Create home page with subscription overview
- [x] Create subscriptions management page (add/remove channels)
- [x] Create summary history page
- [x] Create settings page (email preferences, frequency)
- [x] Implement loading states and error handling

## Phase 5: Testing & Scheduling
- [x] Write vitest tests for subscription management
- [x] Write vitest tests for summary generation
- [x] Write vitest tests for email sending
- [x] Test daily scheduled job
- [x] Test YouTube API rate limit handling

## Phase 6: Final Polish
- [x] Add empty states for no subscriptions
- [x] Add toast notifications for user actions
- [x] Verify responsive design
- [x] Final end-to-end testing
- [x] Create checkpoint for deployment

## New Feature: Auto-fetch and summarize on channel add
- [x] Modify subscriptions.add endpoint to fetch recent 3 videos
- [x] Generate AI summaries for fetched videos
- [x] Save videos and summaries to database
- [x] Update frontend to show loading state during processing
- [x] Display generated summaries after channel is added
- [x] Add error handling for API failures
- [x] Write tests for new functionality

## Enhancement: Korean summaries and video count setting
- [x] Add videoCount field to userSettings table
- [x] Modify AI summarizer to generate summaries in Korean
- [x] Add video count selector to Settings page (1-10 videos)
- [x] Update subscription.add endpoint to use user's videoCount setting
- [x] Update tests to verify Korean summaries
- [x] Test with different video count settings

## Enhancement: Dynamic summaries based on video length with tabs
- [x] Add detailedSummary field to summaries table
- [x] Modify AI summarizer to generate both brief and detailed summaries
- [x] Adjust summary length based on video duration (short/medium/long)
- [x] Update subscription.add to generate both summary types
- [x] Add Tabs component to Subscriptions page summary dialog
- [x] Add Tabs component to Summaries page
- [x] Test with videos of different lengths

## New Feature: YouTube Transcript Integration
- [x] Install youtube-transcript npm package
- [x] Create transcript fetching function in youtube.ts
- [x] Modify summarizer to use transcript when available
- [x] Fallback to title+description if transcript unavailable
- [ ] Test with videos that have/don't have transcripts

## New Feature: Daily Auto-Check for New Videos
- [x] Create cron job that runs daily
- [x] Fetch all user subscriptions
- [x] Check for new videos since last check
- [x] Generate summaries for new videos
- [x] Add logging for monitoring

## New Feature: Manual Refresh Button
- [x] Add backend API endpoint to manually trigger video check
- [x] Add "Check for New Videos" button to Dashboard
- [x] Show loading state during refresh
- [x] Display toast notification with results
