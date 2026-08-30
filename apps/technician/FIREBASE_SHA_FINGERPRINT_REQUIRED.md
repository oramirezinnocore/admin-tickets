# Firebase SHA Fingerprint Configuration Required

## Issue: WIS-ANDROID-HF10

**Error:** `AUTHENTICATION_FAILED` when requesting FCM token

**Root Cause:** The SHA-1 and SHA-256 fingerprints of the Android signing keystore used by EAS Build are not registered in Firebase Console.

## Why This Happens

Firebase uses certificate fingerprints to authenticate your app. When EAS Build creates the APK, it signs it with a keystore. Firebase must know the SHA fingerprints of that keystore to allow FCM authentication.

## How to Fix

### Step 1: Get the Keystore Fingerprints from EAS

```bash
cd apps/technician

# Get credentials info
eas credentials

# Select: Android → Production → View keystore
# OR download the keystore
eas credentials -p android
```

**Alternative:** If you have the keystore file:
```bash
keytool -list -v -keystore your-keystore.jks
```

You need:
- **SHA-1 fingerprint** (required)
- **SHA-256 fingerprint** (recommended)

Example format:
```
SHA-1: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD
SHA-256: AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB
```

### Step 2: Add Fingerprints to Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: **Wisper Ticketing Dev**
3. Click **⚙️ Settings** (gear icon) → **Project settings**
4. Scroll down to **Your apps** section
5. Find the Android app: **com.wisper.technician**
6. Click **Add fingerprint**
7. Paste the **SHA-1** fingerprint
8. Click **Save**
9. Click **Add fingerprint** again
10. Paste the **SHA-256** fingerprint
11. Click **Save**

### Step 3: Download Updated google-services.json

1. In the same Firebase app settings page
2. Click **Download google-services.json**
3. Replace the existing file:
   ```bash
   # From project root
   cp ~/Downloads/google-services.json apps/technician/google-services.json
   ```

### Step 4: Rebuild APK with EAS

```bash
cd apps/technician
eas build --platform android --profile preview
```

### Step 5: Verify FCM Works

1. Install the new APK on Android device
2. Open the app
3. Login with technician credentials
4. Check logs - should see:
   ```
   [Push][android] Token generated: YES
   [Push][android] Token suffix: ...ABC12345
   [Push][android] Token persisted: YES
   ```
5. Verify in Supabase:
   ```sql
   SELECT * FROM technician_push_tokens 
   WHERE platform = 'android' 
   ORDER BY updated_at DESC;
   ```

## Current Configuration

**Firebase Project:** wisper-ticketing-dev  
**Project Number:** 200213145398  
**Android Package:** com.wisper.technician  
**App ID:** 1:200213145398:android:f0ac915759ad763539b597

**google-services.json status:**
- ✅ Present in repository
- ✅ Package name matches: com.wisper.technician
- ✅ Configured in app.json
- ❌ **SHA fingerprints NOT registered** (suspected)

## Verification Checklist

Before rebuild:
- [ ] SHA-1 fingerprint added to Firebase Console
- [ ] SHA-256 fingerprint added to Firebase Console
- [ ] google-services.json downloaded (may be unchanged)
- [ ] FCM API enabled in Google Cloud Console

After rebuild:
- [ ] New APK installed on device
- [ ] Login successful
- [ ] Push token generated (check logs)
- [ ] Token saved to `technician_push_tokens` with `platform='android'`
- [ ] Test push notification from Admin

## Additional Notes

**Why wasn't this needed for iOS?**  
iOS uses APNs (Apple Push Notification service) with different authentication (APNs key/certificate). Android uses FCM (Firebase Cloud Messaging) which requires certificate fingerprints.

**What if I don't have access to EAS credentials?**  
The Android keystore is managed by EAS. You need proper EAS account access to view/download the keystore and get its fingerprints.

**Can I use a different keystore?**  
Not recommended. EAS manages the production keystore. Changing it would require re-publishing to Play Store with a different signature.

## Related Files

- `apps/technician/google-services.json` - Firebase Android config
- `apps/technician/app.json` - Expo configuration
- `apps/technician/eas.json` - EAS Build configuration
- `supabase/migrations/20260819110000_create_push_tokens.sql` - Database table

## References

- [Firebase: Add SHA fingerprints](https://firebase.google.com/docs/android/setup#console-add-config-file)
- [EAS Build: Android credentials](https://docs.expo.dev/app-signing/app-credentials/)
- [Expo Notifications: FCM setup](https://docs.expo.dev/push-notifications/fcm-credentials/)
