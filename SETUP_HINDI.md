# GharFresh — Setup गाइड (एक बार, ऊपर से नीचे)

> यह **नया और अलग** प्रोजेक्ट है। पुरानी साइट, पुराना Supabase और पुराना GitHub repo बिल्कुल न छुएँ।

## 1. नया Supabase प्रोजेक्ट
1. supabase.com → **New project** (नया नाम, जैसे `gharfresh`)। Region: Mumbai।
2. **SQL Editor** खोलें और इन फ़ाइलों को **इसी क्रम में**, एक-एक करके पूरी चिपकाकर Run करें:
   `supabase/001` → `002` → `003` → `004` → `005`
   (`006` सबसे आख़िर में, स्टेप 7 में।)
3. **Project Settings → API** से तीन चीज़ें नोट करें: Project URL, `anon` key, `service_role` key।
   ⚠️ `service_role` key किसी को न दिखाएँ, सिर्फ़ Render के environment में डालें।

## 2. लॉगिन ईमेल (OTP)
1. **Authentication → Providers → Email** चालू रखें।
2. **Authentication → Emails → Templates** में **Magic Link** और **Confirm signup** दोनों टेम्पलेट में लिंक की जगह OTP कोड डालें, जैसे: `आपका GharFresh OTP: {{ .Token }}`
3. ईमेल जल्दी पहुँचें इसके लिए **Authentication → SMTP Settings** में Brevo का SMTP भरें (Brevo → SMTP & API → SMTP)।
4. (अगर साइन-अप में सिर्फ़ रजिस्टर्ड लोग चाहिए तो बाद में बताइए, उसे सख़्त कर दूँगा।)

## 3. नया GitHub repo
1. GitHub पर **नया** repo बनाएँ (जैसे `gharfresh`)।
2. इस zip की सारी फ़ाइलें उसमें डालें। `.env` फ़ाइल कभी अपलोड न करें।

## 4. Render पर नई वेबसाइट
1. Render → **New → Web Service** → नया repo चुनें।
2. Build: `npm install && npm run build`, Start: `npm start`
3. **Environment** में ये भरें:

| नाम | कहाँ से |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase → API |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase → API (anon) |
| SUPABASE_SERVICE_ROLE_KEY | Supabase → API (service_role) |
| BREVO_API_KEY | Brevo → SMTP & API → API Keys |
| BREVO_SENDER_EMAIL | Brevo में verify किया हुआ ईमेल |
| BREVO_SENDER_NAME | GharFresh |
| CRON_SECRET | कोई लंबा random पासवर्ड (खुद बनाएँ, याद रखें) |

4. Deploy करें। साइट का पता मिलेगा, जैसे `https://gharfresh.onrender.com`।

## 5. पहला admin
1. साइट पर अपने ईमेल से साइन-अप करें।
2. Supabase SQL Editor में चलाएँ:
```sql
update public.profiles set role = 'admin' where email = 'आपका-ईमेल';
```
3. `/admin` खोलें।

## 6. शुरुआती डेटा (Admin से)
1. **Zones:** डिलीवरी इलाके (नाम, पिनकोड, फीस)। इलाके के बिना कोई पता नहीं जुड़ेगा।
2. **Products:** पहले एक Category बनाएँ, फिर products (दाम, stock)। फोटो के लिए इमेज का लिंक डालें।
3. **Riders:** rider को पहले ऐप में साइन-अप करवाएँ, फिर Riders पेज पर उसका ईमेल डालकर role "Rider" करें।
4. **Customers → Add money:** ग्राहक UPI से पैसे दे तो यहाँ से वॉलेट में जोड़ें। (ऑनलाइन रिचार्ज के लिए Razorpay/Cashfree अगला चरण है, आपकी मंज़ूरी और खाते के बाद।)

## 7. ऑटोमेशन चालू करें (सबसे आख़िर में)
1. Supabase → **Database → Extensions** में `pg_cron` और `pg_net` चालू करें।
2. `supabase/006_schedules.sql` खोलकर `YOUR-APP` (आपकी Render साइट का नाम) और `YOUR_CRON_SECRET` (स्टेप 4 वाला पासवर्ड) बदलें, फिर Run करें।
3. इससे रोज़ रात **10:15 PM** पर अगले दिन के orders अपने-आप बनेंगे और हर मिनट ईमेल सूचनाएँ जाएँगी।

## 8. टेस्ट की सूची (पहले खुद आज़माएँ)
- [ ] ग्राहक साइन-अप, OTP, पता जोड़ना
- [ ] Subscribe करना, Plans में pause/resume
- [ ] Admin से वॉलेट में पैसे जोड़ना → Basket से order → cancel पर refund
- [ ] Admin → Dashboard → **Generate next day's orders now** → Orders में दिखे
- [ ] Orders → route बनाकर rider को असाइन करना
- [ ] Rider ऐप: Start route → Delivered (फोटो+GPS) → ग्राहक को ईमेल आना
- [ ] Rider: Failed → ग्राहक का "Refund to wallet" → पैसे वॉलेट में
- [ ] फोन का नेट बंद करके rider से Delivered करना, नेट आने पर सिंक होना

## ज़रूरी जानकारी
- **Cut-off:** रात 10:00 PM (Admin/settings की `app_settings` तालिका में `order_cutoff_time` से बदल सकते हैं)
- **वॉलेट कम हो तो:** order "On hold" हो जाता है, पैसे नहीं कटते, ग्राहक को ईमेल जाती है। पैसे जुड़ने पर Admin उसे release कर सकता है (`admin_release_held_order`)।
- **रात के जॉब की गलतियाँ देखने के लिए (SQL):**
```sql
select created_at, action, details from public.audit_log
where action in ('nightly_generation','generation_error','sub_skipped')
order by created_at desc limit 50;
```
- **अभी शामिल नहीं:** phone OTP (SMS की पेड सर्विस चाहिए), WhatsApp, Razorpay/Cashfree रिचार्ज, offers/banners, QR। ये आपकी मंज़ूरी के बाद अगले चरण में।
- Render की free सेवा कुछ देर बाद सो जाती है। हर मिनट वाला ईमेल जॉब उसे जगाए रखता है, फिर भी असली काम के लिए paid प्लान बेहतर है।
