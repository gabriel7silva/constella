---
name: firebase
description: Firebase is Google's Backend-as-a-Service platform (Auth, Firestore, Realtime Database, Cloud Functions, Hosting, Cloud Storage, FCM). Consult when building serverless app backends, adding Google/email auth, syncing NoSQL data in real time, deploying static/SSR hosting, writing Cloud Functions, or using the Firebase CLI/emulator suite.
domain: stack
category: baas
tags: [firebase, baas, google, firestore, auth, serverless, cloud-functions]
official_sources:
  - https://firebase.google.com/docs
  - https://github.com/firebase/firebase-tools
  - https://www.npmjs.com/package/firebase-tools
verified: 2026-06-17
---

# Firebase

## Overview
Firebase is Google's Backend-as-a-Service platform that bundles authentication, NoSQL databases (Cloud Firestore and the older Realtime Database), serverless Cloud Functions, static/SSR Hosting, Cloud Storage, and messaging behind client SDKs and a single CLI. It removes the need to run your own backend for most app features. Read this when adding auth, real-time data sync, file storage, push notifications, or deploying functions/hosting from the Firebase CLI.

## Official sources
- Docs: https://firebase.google.com/docs
- Repo: https://github.com/firebase/firebase-tools
- Install: https://www.npmjs.com/package/firebase-tools

## Install / setup
```bash
npm install -g firebase-tools
firebase login
firebase init
```
Source: https://firebase.google.com/docs/cli

## Core concepts
- **Project** — top-level container; one project holds all Firebase products and maps to a Google Cloud project.
- **Cloud Firestore** — scalable document/collection NoSQL DB with real-time listeners and offline cache; preferred over Realtime Database for new apps.
- **Authentication** — managed identity (email/password, Google, Apple, phone, anonymous, OIDC/SAML) issuing ID tokens verified by Security Rules.
- **Security Rules** — declarative server-side access control evaluated per request for Firestore, Storage, and Realtime Database.
- **Cloud Functions** — serverless Node/Python handlers triggered by HTTPS, Firestore/Auth events, schedules, or Pub/Sub.
- **Hosting** — global CDN for static assets and SSR frameworks (Next.js/Angular), wired to functions via rewrites.
- **Emulator Suite** — local emulators for Auth, Firestore, Functions, Hosting for offline development and CI.

## Best practices
- Write and test Security Rules first; never rely on client-side checks alone (https://firebase.google.com/docs/rules).
- Develop against the Emulator Suite before touching production data (https://firebase.google.com/docs/emulator-suite).
- Model Firestore data for your queries — denormalize and avoid unbounded collection scans (https://firebase.google.com/docs/firestore/data-model).
- Keep API keys/config public but lock data with Rules and App Check (https://firebase.google.com/docs/app-check).

## Common pitfalls
- Default-open or test-mode Security Rules left in production → leaked/writable data; deploy least-privilege rules before launch.
- Missing composite indexes for compound queries → query fails at runtime; create the suggested index from the error link.
- Per-document write contention on hot Firestore documents → throttling; shard counters or distribute writes.

## Examples
```javascript
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";

const app = initializeApp({ projectId: "demo", apiKey: "..." });
const db = getFirestore(app);

await addDoc(collection(db, "messages"), {
  text: "hello",
  createdAt: Date.now(),
});
```

## Further reading
- https://firebase.google.com/docs/firestore — Cloud Firestore guide
- https://firebase.google.com/docs/functions — Cloud Functions reference
- https://firebase.google.com/docs/cli — Firebase CLI reference

## Related skills
- ../appwrite — open-source self-hosted BaaS alternative
- ../amplify — AWS fullstack BaaS with similar auth/data/functions
