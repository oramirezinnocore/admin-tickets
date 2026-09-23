# WIS-ANDROID-PRODUCTION-APK

**Date:** 2026-09-22  
**Purpose:** Direct APK distribution for Wisper Técnicos mobile app  
**Distribution:** Internal (no Google Play)  
**Platform:** Android

---

## PURPOSE

This document describes the configuration for building production-ready Android APKs that can be:
- Downloaded via direct link
- Installed directly on Android devices
- Maintained indefinitely (no artificial expiration)
- Updated by installing newer APKs with same package identity

**NOT for Google Play Store** (use `production` profile for Play Store AAB if needed).

---

## PROJECT CONFIGURATION

### Expo Project

**Owner:** jora85  
**Project:** @jora85/technician  
**Project ID:** 88e5bd23-c425-46e8-9f0d-2f57f03aef33  
**Slug:** technician  
**App Name:** Wisper Técnicos

### Android Configuration

**Package Name:** `com.wisper.technician`  
**Version:** Managed remotely by EAS (`appVersionSource: "remote"`)  
**Version Code:** Auto-incremented by EAS  
**Signing:** Managed by EAS (credentials stored securely)

⚠️ **CRITICAL:** Package name and signing identity must NEVER change for updates to work.

---

## BUILD PROFILES

### `preview` (Existing - QA/Testing)

```json
"preview": {
  "distribution": "internal",
  "android": {
    "buildType": "apk"
  }
}
```

**Use case:** Internal testing, QA validation  
**Output:** APK  
**Distribution:** Internal link from EAS

---

### `production-apk` (New - Client Distribution)

```json
"production-apk": {
  "distribution": "internal",
  "autoIncrement": true,
  "android": {
    "buildType": "apk"
  }
}
```

**Use case:** Production release to Wisper client  
**Output:** APK  
**Distribution:** Direct download link  
**Auto-increment:** YES - version code increases automatically  
**Standalone:** YES - does not require Expo Go or Metro  
**Expiration:** NONE - works indefinitely

---

### `production` (Reserved - Future Play Store)

```json
"production": {
  "autoIncrement": true
}
```

**Use case:** Google Play Store submission (if needed in future)  
**Output:** AAB (Android App Bundle)  
**Status:** Not currently used

---

## BUILDING PRODUCTION APK

### Prerequisites

1. **EAS CLI installed:**
   ```bash
   npm install -g eas-cli
   ```

2. **Authenticated with Expo:**
   ```bash
   eas login
   ```

3. **Environment variables configured in EAS:**
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   
   ⚠️ **Never commit .env.local to repository**

### Build Command

```bash
cd apps/technician

npx eas-cli build --platform android --profile production-apk
```

**What happens:**
1. Code uploaded to EAS servers
2. Android build with production configuration
3. APK signed with managed credentials
4. Version code auto-incremented
5. Build artifacts stored on EAS

**Build time:** ~10-15 minutes

---

## DOWNLOADING THE APK

After build completes:

1. EAS provides a download URL (valid for 30 days)
2. Download APK to your computer
3. **Store APK permanently** (EAS link expires)

**Recommended storage:**
- Local backup
- Internal file server
- Future: downloads.intuspath.com/wisper

**File name example:**
```
wisper-tecnicos-v1.0.0-build123.apk
```

---

## INSTALLING ON ANDROID

### First Installation

1. **Enable Unknown Sources:**
   - Settings → Security → Install unknown apps
   - Enable for your browser/file manager

2. **Transfer APK to device:**
   - USB transfer, or
   - Download directly on device, or
   - Send via email/messaging app

3. **Open APK file:**
   - Tap to install
   - Accept permissions
   - Wait for installation

4. **Launch:**
   - Find "Wisper Técnicos" in app drawer
   - Login with credentials

### Verification

**Package name:** com.wisper.technician  
**App name:** Wisper Técnicos  
**Icon:** Blue with "W" logo

---

## UPDATING EXISTING INSTALLATION

### When to Build Update

- Bug fixes
- New features
- Backend API changes
- Security updates

### Update Process

1. **Increment version** (if not using `appVersionSource: "remote"`):
   ```json
   "version": "1.1.0"  // In app.json
   ```

2. **Build new APK:**
   ```bash
   npx eas-cli build --platform android --profile production-apk
   ```

3. **Download new APK**

4. **Distribute to users:**
   - Same installation process
   - Android recognizes same package
   - Prompts to **update** existing app (not reinstall)

5. **User installs:**
   - Data preserved
   - Settings preserved
   - Login session may persist

### Update Requirements

✅ **Must preserve:**
- Package name: `com.wisper.technician`
- Signing credentials (EAS managed)
- Version code must be higher

❌ **Never change:**
- Package name
- Owner/Project ID
- Signing keystore

---

## ENVIRONMENT VARIABLES

### Production Configuration

APK must connect to production Wisper backend.

**Required variables (configured in EAS):**

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Setting variables in EAS:**

```bash
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "..."
eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
```

Or via Expo dashboard: https://expo.dev/accounts/jora85/projects/technician/secrets

⚠️ **Security:**
- Only `EXPO_PUBLIC_*` variables are included in APK
- NEVER include `SUPABASE_SERVICE_ROLE_KEY` in mobile app
- Anon key is safe to include (public key for client access)

---

## CREDENTIAL MANAGEMENT

### Android Signing

**Strategy:** EAS Managed Credentials

**What this means:**
- EAS generates and stores Android keystore
- Same keystore used for all builds
- Credentials never leave EAS servers
- Updates work seamlessly

**Credential location:**
- Stored in Expo account (jora85)
- Project: technician
- Platform: android
- Type: keystore

### ⚠️ CRITICAL WARNINGS

**NEVER:**
- Delete credentials from EAS
- Generate a new keystore manually
- Change package name
- Change project owner without migration
- Download and lose the keystore

**If credentials are lost:**
- New builds will have different signature
- Users CANNOT update existing app
- Must uninstall old app and reinstall (loses data)

### Viewing Credentials

```bash
eas credentials --platform android
```

Select profile → View credentials (read-only)

---

## VERSION MANAGEMENT

### Current Strategy

**Version source:** Remote (managed by EAS)

```json
{
  "cli": {
    "appVersionSource": "remote"
  }
}
```

**Behavior:**
- EAS tracks version code remotely
- Auto-increments on each production-apk build
- No manual version code management needed

### Version Number (app.json)

```json
"version": "1.0.0"
```

**Update manually before major releases:**
- 1.0.0 → 1.1.0 (minor features)
- 1.0.0 → 2.0.0 (major changes)

**Visible to users in:**
- About screen (if implemented)
- App info (Android settings)

---

## VALIDATION

### Before Building

```bash
# TypeScript check
npx tsc --noEmit

# Expo configuration check
npx expo-doctor

# EAS validation
eas build:configure
```

### After Building

1. **Download APK**
2. **Install on physical Android device** (not emulator)
3. **Test critical flows:**
   - Login
   - Ticket list
   - Camera/evidence upload
   - Signature capture
   - Location tracking
   - Push notifications

---

## DISTRIBUTION WORKFLOW

### Current Process

1. Developer builds production-apk via EAS
2. Downloads APK from EAS
3. Sends APK to client via secure channel
4. Client distributes to technicians

### Future Enhancement

Planned: downloads.intuspath.com/wisper

- Public download page
- Version history
- Release notes
- QR code for easy download

---

## TROUBLESHOOTING

### Build Fails

**Check:**
- EAS CLI updated: `npm install -g eas-cli@latest`
- Authenticated: `eas whoami`
- Environment variables set: `eas secret:list`
- No TypeScript errors: `npx tsc --noEmit`

### APK Won't Install

**Check:**
- Unknown sources enabled
- Sufficient storage space
- Not blocked by antivirus/MDM

### Update Won't Install

**Check:**
- Package name matches: `com.wisper.technician`
- Version code is higher (automatic with EAS)
- Not trying to downgrade version

**If error "App not installed":**
- Signature mismatch (credentials changed)
- Must uninstall old app first

### App Crashes on Launch

**Check:**
- Environment variables configured in EAS
- Backend URL correct
- Supabase anon key valid
- Check logs: `adb logcat | grep ReactNative`

---

## WHAT NOT TO DO

❌ **DO NOT:**
- Change package name in app.json
- Regenerate Android credentials
- Use `developmentClient: true` for production-apk
- Commit .env.local with secrets
- Delete EAS build artifacts immediately
- Change Expo owner/project ID
- Build with `--local` flag (use EAS cloud builds)

✅ **DO:**
- Keep APK backups
- Document each release version
- Test on physical devices
- Preserve EAS credentials
- Use `production-apk` profile for client releases
- Use `preview` profile for internal testing

---

## FUTURE CONSIDERATIONS

### EAS Update (OTA Updates)

**Current status:** Not configured

**If implemented in future:**
- Allows updates without APK reinstall
- JavaScript/asset updates only
- Native code changes still require APK
- Channel-based distribution

**Would require:**
- `expo-updates` package
- Channel configuration in eas.json
- Runtime version strategy

### Google Play Store

**If published to Play Store in future:**
- Use `production` profile (not `production-apk`)
- Output: AAB (Android App Bundle)
- Signing: Upload key (EAS managed)
- Distribution: Play Console

---

## COMMANDS REFERENCE

### Build

```bash
# Production APK for distribution
npx eas-cli build --platform android --profile production-apk

# Preview APK for internal testing
npx eas-cli build --platform android --profile preview

# Check build status
eas build:list --platform android --limit 10

# View specific build
eas build:view <build-id>
```

### Credentials

```bash
# View credentials (interactive)
eas credentials --platform android

# List secrets
eas secret:list

# Create secret
eas secret:create --scope project --name VAR_NAME --value "..."
```

### Project

```bash
# View project info
eas project:info

# Check account
eas whoami
```

---

## CONTACTS

**Expo Account:** jora85  
**Project:** @jora85/technician  
**Backend:** Supabase (admin-tickets project)

---

**Last updated:** 2026-09-22  
**Profile version:** 1.0  
**EAS CLI version:** >= 22.0.0
