# CareerScope Login Credentials

## Admin Account

**Role:** Admin  
**Email:** `admin@careerscope.lib`  
**Phone:** `0880000000`  
**Password:** `Liberia2025!`

---

## Student Accounts

### Test Student 1
**Role:** Student  
**Name:** John Brown  
**Phone:** `0778889990`  
**Email:** `johnbrown@gmail.com`  
**Password:** `student123`

### Test Student 2 (Created on next server restart)
**Role:** Student  
**Name:** Test Student  
**Phone:** `0771234567`  
**Email:** `student@test.com`  
**Password:** `student123`

---

## Counselor Accounts

### Test Counselor 1
**Role:** Counselor  
**Name:** Sam Brown  
**Phone:** `0775592486`  
**Email:** `sambrown@gmail.com`  
**Password:** `counselor123`  
**Status:** Approved ✅

### Test Counselor 2 (Created on next server restart)
**Role:** Counselor  
**Name:** Test Counselor  
**Phone:** `0881234567`  
**Email:** `counselor@test.com`  
**Password:** `counselor123`  
**Status:** Approved ✅

---

## How to Login

1. Go to the login page: http://localhost:5173
2. Select the appropriate role (Student, Counselor, or Admin)
3. Enter either:
   - **Phone number** (recommended), OR
   - **Email address**
4. Enter the password
5. Click "Login"

## Notes

- All test accounts are **pre-approved** and ready to use
- You can also **register new accounts** through the registration form
- Counselor accounts require admin approval (but test counselors are pre-approved)
- Passwords can be reset using the script: `server/scripts/reset-test-passwords.js`

## Quick Login Examples

### Admin Login:
- Phone: `0880000000`
- Password: `Liberia2025!`
- Role: Select "Admin"

### Student Login:
- Phone: `0778889990`
- Password: `student123`
- Role: Select "Student"

### Counselor Login:
- Phone: `0775592486`
- Password: `counselor123`
- Role: Select "Counselor"

