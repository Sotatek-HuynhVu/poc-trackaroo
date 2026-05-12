Technical Specification Report: trackaroo® Phase 1 Backend Architecture

1. Architecture Paradigm: Survival Core vs. Experience Layer

The trackaroo® platform is governed by the mandatory Product Anchor Statement (VDP-5026):

"trackaroo® supports safer human decision-making for people travelling and operating in remote or low-signal outdoor environments, when digital information becomes limited or uncertain."

The architecture follows a "Cognitive Hierarchy" philosophy, ensuring that safety-critical functions remain operational regardless of connectivity or higher-level feature failure. This is achieved through a structural "Hard Boundary" between the Survival Core and the Experience & Intelligence Layer.

Architectural Component Assignment

Survival Core (Safety-Critical / Offline)	Experience Layer (Value-Add / Online)
Offline Navigation (Mapbox/OSM Tiles)	TrackIQ™ Scoring & Metadata Display
BackTrack™ Breadcrumb Logging	Group Management & Sync
SOS Emergency Module	Subscription Logic & IAP
HazTrack™ Overlay Rendering	First Aid Reference (Universal Baseline)
TrackMate™ Mesh Fundamentals	User Archetype Personalization
Local Safety Logging	OCS First Aid Content Management
Comms Abstraction Layer (CAL)	Operations Console (OCS) Moderation

One-Way Communication Rule: To preserve safety integrity, display preferences flow from the Experience Layer to the Survival Core via a strictly mediated interface. LLM Command: Ensure all Experience Layer interactions with the Survival Core are mediated via the DisplayPreferenceManager interface, which uses immutable value objects to prevent memory-space mutation of core safety data.

2. Strict Isolation & Connectivity Logic

Survival Core Isolation (Absolute Grounding)

The Survival Core is a sealed, deterministic subsystem. It operates under the "Absolute Grounding" principle: no code path within the core may resolve DNS, initiate socket connections, or call internet-dependent services, even if the OS reports active connectivity. Isolation is enforced at the compile-time level through dependency rules and verified by automated CI/CD gates that reject any network-dependent library imports into the Survival Core module.

Firebase/Firestore Isolation Model

Firebase is permitted exclusively within the Experience Layer for the following:

* Auth: User login/signup via Firebase Auth.
* Cloud Sync: Synchronizing non-safety data (profiles, preferences, PCR metadata) when online.
* Crashlytics: Error reporting, stripped of all location and emergency data.

The "Zero Firestore" Rule: No Firestore collections may exist within the Survival Core. Survival Core data (location fixes, breadcrumbs, SOS logs, hazard caches) is never stored, mirrored, or synced to cloud services. This is enforced via Static Code Analysis (SCA) in the CI pipeline.

3. Comms Abstraction Layer (CAL) State Machine

The CAL acts as a polymorphic Transport Registry utilizing an ITransport interface. This allows for a refactoring-free transition to Phase 2.

1. satReady: A Phase 1 compile-time constant set to false. To prevent SDK bloat, all satellite-related calls are routed to a NullSatelliteAdapter.
2. queueEnabled: Set to true for Phase 1. Outbound messages are stored in an AES-256 encrypted SQLite queue utilizing a Write-Ahead Log (WAL) for crash survival.
3. offlineBeacon: A heartbeat mechanism (5-second intervals) used for peer-to-peer presence in the BLE mesh, allowing members to infer "Active" status without cloud relay.
4. partialSignal: Dynamically computed based on packet loss (>50%) and latency (>2s). This triggers "limited connectivity" UI indicators and throttles non-essential OCS syncs.

4. Persistence Layer & Data Integrity

Local-Only Persistence

Data is stored in a local SQLite database secured with AES-256 page-level encryption. To ensure zero unauthorized cloud mirroring, the data directory is flagged with NSURLIsExcludedFromBackupKey (iOS) and fullBackupContent (Android) to exclude it from OS-level backups.

Write-Ahead Log (WAL) & Immutability

WAL guarantees that safety-critical writes (breadcrumbs, message queues) survive app force-closes or device restarts. The system enforces a "Write-Once, Read-Many" protocol for BackTrack™ breadcrumbs:

* Prohibited Operations: Modification, post-processing/smoothing, deletion, or silent suppression of points.
* Engine-Level Enforcement: Database triggers block UPDATE or DELETE statements. Any attempt to mutate data must return the SQLITE_READONLY error code, triggering a high-severity system log entry.

5. TrackMate™ Transport & Fallback Hierarchy

Tier 1 Primary: BLE Mesh

Utilizes multi-hop relay with managed flooding. It requires a Foreground Service (Android) or Background Task (iOS).

* Constraint: Additional battery drain must be ≤0.5% per hour (vendor target: 0.3%).
* Optimization: Achieved through BLE extended advertising at 1-second intervals and duty-cycled scanning.

Tier 1 Fallback: Wi-Fi Direct

Auto-activated by the CAL if BLE peer counts drop below 2. It is never active in the background and is torn down after a 5-minute idle timer. Battery drain is capped at ≤2% per hour during active use.

Tier 2 Scaffold: LoRa

A non-executable scaffold (loraReady = false) supporting specific hardware bridges:

* USB/Serial Bridge: Android via USB OTG; iOS via user-supplied USB-C to USB-A adapter (required due to host restrictions).
* BLE-Only Bridge (Preferred iOS Path): Direct communication with Meshtastic hardware via CoreBluetooth / ITransport interface.

6. SOS Module & Emergency Safety Framework (ESF-5026)

Activation & Discipline

SOS activation follows a "≤2 tap" rule from any screen, bypassing device authentication (lock screen). Touch targets must be glove-compatible (minimum 60x60pt).

3-Stage SOS Sequence

* Stage 1: Immediate logging of timestamp and device ID.
* Stage 2: Display of "GPS Pending" status.
* Stage 3: Coordinate append upon GNSS fix.

Distress Breadcrumb Mode (RT-23 Compliance)

Upon activation, logging density increases to 5m/5s. Per RT-23 Compliance, this is a "Free Tier" feature and cannot be gated by subscriptions.

QR Handover

Generates ISO 8601-compliant Plain Text QR codes for field responders. To ensure universal compatibility, these codes contain no deep links and can be scanned by any standard camera app.

7. HazTrack™ & TrackIQ™ Processing Logic

HazTrack™ Independence Rule

Hazard feed ingestion is limited to government-only sources (BOM, AFAC, SES).

* Independence Rule: Hazard feed freshness indicators must NEVER use the shield icon or any visual treatment that could be confused with the TrackIQ™ verification shield state.
* TTL/Caching: Deterministic TTLs (15/30/60 min) use Gold/Grey/Muted age badges.

TrackIQ™ Deterministic Scoring

Scoring follows AWTGS/IMBA gradient schemas:

* Vehicle/4WD: Easy (≤10%), Moderate (10–20%), Difficult (20–30%), Extreme (>30%).
* Trail/MTB: Easy (≤5%), Moderate (5–15%), Difficult (15–25%), Extreme (>25%).
* Foot/Hike: Graded 1–5 per AWTGS standards.

Stop Detection

Triggered by <15m movement over 10 minutes. To prevent "alarm fatigue," the neutral wellness prompt allows for a maximum of 3 re-prompts before the system silences for the remainder of the stationary episode.

8. Operations Console (OCS) Backend Management

RBAC & PCR Moderation

OCS utilizes Role-Based Access Control for Project Directors, Operations, and Authorized Contributors.

* Supersession Model: PCRs are never deleted. A "resolved" report is simply a new record at the same coordinates that supersedes the old one in the display layer. A 90-day alert system identifies stale reports for review.

Clinical Review Gate

First Aid content is managed via the OCS and is locked behind a "Release Flag." Activation requires a clinician-signed attestation (PDF) uploaded by the Project Director. All governance actions are recorded in an immutable audit log capturing "Previous vs. New State."

9. Phase 2 Scaffolding & Future Readiness

Inert Stubs & Schema Preservation

Phase 1 includes non-executable placeholders (Inert Stubs) for Satellite Relay, Snow/Alpine grading, and the Emergency Escrow pathway. The BackTrack™ schema preserves escrow fields (flag/sequence) per BTF-5126 §7, but these are blocked by the logic layer in Phase 1.

Prohibited Capability Triggers

The build must be verified clear of the 22 prohibited triggers (RT-01 to RT-22), including:

* RT-01: Automated emergency dispatch/distress alerts.
* RT-05: Cloud-based navigation dependencies in the Survival Core.
* RT-12: Modification or smoothing of logged breadcrumb data.
* RT-21: Predictive "safe area" inferences or hazard consolidation.
