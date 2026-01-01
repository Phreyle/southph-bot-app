# Testing Guide for New Features

## Prerequisites
- Bot must be running (`npm start`)
- You need appropriate permissions to use commands
- Test in a Discord server where the bot is installed

## Test 1: OCR Feature in CTA Regear Thread

### Steps:
1. **Create a CTA regear thread:**
   ```
   /ctaregear title: "Test CTA Regear OCR"
   ```
   ✅ Expected: Thread created with message "✅ CTA regear thread created: Test CTA Regear OCR"

2. **Upload a test image in the thread:**
   - Take a screenshot showing "Est. Market Value" with a number
   - Or use your sample image (Est. Market Value ⚪ 504,360)
   - Post it in the thread

3. **Check bot response:**
   ✅ Expected: Bot replies with `💰 **Est. Market Value:** [number]`
   - Example: `💰 **Est. Market Value:** 504,360`

### Console Output to Check:
```
📸 Image detected in regear thread: [url]
🔍 Starting OCR for image: [url]
📝 OCR Text extracted: [text]
✅ Found market value: [value]
```

---

## Test 2: OCR Feature in FF Regear Thread

### Steps:
1. **Create an FF regear thread:**
   ```
   /ffregear title: "Test FF Regear OCR"
   ```
   ✅ Expected: Thread created with message "✅ FF regear thread created: Test FF Regear OCR"

2. **Upload a test image in the thread:**
   - Post an image with "Est. Market Value" text
   
3. **Check bot response:**
   ✅ Expected: Bot replies with the extracted market value

---

## Test 3: FFROA Fill Player Auto-Assignment (via adduser)

### Steps:
1. **Create an FFROA:**
   ```
   /ffroa create role: tank
   ```

2. **Add a fill player:**
   - In the thread, user types: `x fill`
   ✅ Expected: User added to fill list (shows in FILL section)

3. **Manually add users to reach 6 slots:**
   ```
   /ffroa adduser user: @User1 role: heal
   /ffroa adduser user: @User2 role: shadowcaller
   /ffroa adduser user: @User3 role: blazing
   /ffroa adduser user: @User4 role: mp
   /ffroa adduser user: @User5 role: mp2
   ```
   
4. **Check auto-assignment:**
   ✅ Expected: After 6th user added, the fill player should automatically be assigned to the 7th slot (flex)
   ✅ Expected: Bot posts message: "✅ <@fillplayer> has been automatically assigned to **FLEX** from FILL standby!"

### Console Output to Check:
```
✅ Auto-assigning fill players: 6/7 slots filled
```

---

## Test 4: FFROA Fill Player Auto-Assignment (via removeuser)

### Scenario: Roster is full, fill players are waiting

### Steps:
1. **Set up full roster** (all 7 slots filled)

2. **Add fill players:**
   - Users type `x fill` in thread

3. **Remove a user:**
   ```
   /ffroa removeuser role: tank
   ```

4. **Check auto-assignment:**
   ✅ Expected: First fill player automatically assigned to the empty tank slot
   ✅ Expected: Bot posts assignment notification

---

## Test 5: OCR with Different Image Formats

### Test various text patterns:

**Pattern 1: Standard format**
```
Est. Market Value: 504,360
```

**Pattern 2: Symbol format (your sample)**
```
Est. Market Value ⚪ 504,360
```

**Pattern 3: Abbreviated**
```
Market Value: 1.5M
```

**Pattern 4: Short format**
```
Est. Market 250K
```

**Pattern 5: No exact match**
```
Details
Some text
504360
More text
```
✅ Expected: Should extract 504360 as fallback (largest number)

---

## Troubleshooting

### OCR Not Working?
1. Check console for errors
2. Verify image is actually uploaded (not linked)
3. Check image contains readable text
4. Try with clearer/higher quality image

### Fill Players Not Auto-Assigning?
1. Check that 6 or more slots are filled
2. Verify there are players in fill list
3. Check console for "Auto-assigning fill players" message

### Thread Not Tracking?
1. Verify thread was created with `/ctaregear` or `/ffregear` commands
2. Check console for "Added thread [id] to regear tracking" message
3. Remember: Tracking resets when bot restarts

---

## Success Criteria

✅ **OCR Feature:**
- Bot detects images in regear threads
- Bot extracts market value from images
- Bot replies with extracted value

✅ **FFROA Auto-Assignment:**
- Fill players auto-assign at 6+ slots
- Works with `/ffroa adduser`
- Works with `/ffroa removeuser`
- Works with "x role" text commands

✅ **Error Handling:**
- No crashes on bad images
- Silent fail if no value found
- Console logs show what's happening

---

## Quick Test Script

```bash
# 1. Start bot
npm start

# 2. In Discord, run:
/ctaregear title: "Test 1"

# 3. Post test image in thread

# 4. Verify bot replies with market value

# 5. Check console for OCR logs

# Done! ✅
```

---

## Next Steps After Testing

If everything works:
- ✅ Deploy to production
- ✅ Monitor for any issues
- ✅ Consider adding persistent storage for thread IDs

If issues found:
- Check console logs
- Verify dependencies installed
- Review error messages
- Test with different images

