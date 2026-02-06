# 🎫 Ticket System Flow Diagram

## User Journey

```
┌──────────────────────────────────────────────────────────────┐
│                         USER OPENS TICKET                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ User clicks      │
                    │ "Apply" button   │
                    │ in #apply-here   │
                    └─────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ System checks for duplicate   │
              │ open tickets for this user    │
              └───────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
          [Duplicate Found]          [No Duplicate]
                 │                         │
                 ▼                         ▼
        ┌──────────────┐        ┌──────────────────┐
        │ Error message│        │ Increment counter│
        │ with link to │        │ Create channel   │
        │ existing     │        │ ticket-###       │
        │ ticket       │        └──────────────────┘
        └──────────────┘                  │
                                          ▼
                              ┌────────────────────┐
                              │ Set permissions:   │
                              │ - User: Read/Write │
                              │ - Staff: Full      │
                              │ - @everyone: None  │
                              └────────────────────┘
                                          │
                                          ▼
                              ┌────────────────────┐
                              │ Save ticket to     │
                              │ tickets.json       │
                              │ Init transcript    │
                              └────────────────────┘
                                          │
                                          ▼
                              ┌────────────────────┐
                              │ Send "Ticket       │
                              │ Opened" embed to   │
                              │ transcript channel │
                              └────────────────────┘
                                          │
                                          ▼
                              ┌────────────────────┐
                              │ Ping support role  │
                              │ Send header + 3    │
                              │ buttons in channel │
                              └────────────────────┘
```

## Ticket Channel Actions

```
┌──────────────────────────────────────────────────────────────┐
│                    TICKET CHANNEL OPENED                      │
│  Buttons: [Close] [Claim] [Approve]                          │
└──────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   CLOSE      │  │    CLAIM     │  │   APPROVE    │
    │   TICKET     │  │   TICKET     │  │   TICKET     │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                 │
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Staff or     │  │ Staff only   │  │ Staff only   │
    │ Author only  │  │              │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                 │
            │                 │                 │
            ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Update:      │  │ Update:      │  │ Assign role  │
    │ status=closed│  │ claimedBy    │  │ Change nick  │
    │ closedBy     │  │ status=      │  │ Update:      │
    │              │  │ claimed      │  │ status=      │
    │              │  │              │  │ approved     │
    └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                 │
            │                 ▼                 │
            │         ┌──────────────┐          │
            │         │ Send claim   │          │
            │         │ confirmation │          │
            │         │ embed        │          │
            │         └──────────────┘          │
            │                                   │
            └──────────────┬────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ Send "Ticket Closed" │
                │ embed to transcript  │
                │ channel with:        │
                │ - Open/close dates   │
                │ - Staff msg count    │
                │ - Close reason       │
                └──────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ Wait 5 seconds       │
                └──────────────────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ Delete ticket channel│
                └──────────────────────┘
```

## Message Logging Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    MESSAGE SENT IN TICKET                     │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Is author a bot?│
                    └─────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
            [Yes - Bot]               [No - Human]
                 │                         │
                 ▼                         ▼
        ┌──────────────┐        ┌──────────────────┐
        │ Ignore       │        │ Is this channel  │
        └──────────────┘        │ a ticket?        │
                                └──────────────────┘
                                          │
                             ┌────────────┴────────────┐
                             │                         │
                        [Not Ticket]              [Is Ticket]
                             │                         │
                             ▼                         ▼
                    ┌──────────────┐        ┌──────────────────┐
                    │ Ignore       │        │ Check if author  │
                    └──────────────┘        │ has staff role   │
                                            └──────────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │ Create transcript│
                                            │ message object:  │
                                            │ - authorId       │
                                            │ - authorTag      │
                                            │ - isStaff        │
                                            │ - content        │
                                            │ - createdAt      │
                                            └──────────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────┐
                                            │ Append to        │
                                            │ transcript.json  │
                                            │ Increment staff  │
                                            │ count if needed  │
                                            └──────────────────┘
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         GUILD DATA STRUCTURE                     │
└─────────────────────────────────────────────────────────────────┘

/data/guilds/{guildId}/
├── tickets.json          ← All tickets (open + closed)
├── transcripts.json      ← Message logs per ticket
├── panels.json           ← Panel configurations
└── meta.json             ← Ticket counter

┌──────────────────────┐       ┌──────────────────────┐
│   tickets.json       │       │  transcripts.json    │
├──────────────────────┤       ├──────────────────────┤
│ [                    │       │ [                    │
│   {                  │       │   {                  │
│     ticketId: 425,   │◄─────┤     ticketId: 425,   │
│     guildId: "...",  │       │     messages: [      │
│     channelId: "..." │       │       {              │
│     panelId: "apply" │       │         authorId,    │
│     authorId: "...", │       │         isStaff,     │
│     status: "open",  │       │         content,     │
│     openDate: "...", │       │         createdAt    │
│     ...              │       │       }              │
│   }                  │       │     ],               │
│ ]                    │       │     staffMessageCount│
└──────────────────────┘       │   }                  │
                               │ ]                    │
                               └──────────────────────┘

┌──────────────────────┐       ┌──────────────────────┐
│   panels.json        │       │    meta.json         │
├──────────────────────┤       ├──────────────────────┤
│ [                    │       │ {                    │
│   {                  │       │   lastTicketId: 425  │
│     panelId: "apply",│       │ }                    │
│     ticketTypeName,  │       └──────────────────────┘
│     categoryId,      │
│     staffRoleIds,    │
│     approveRoleId,   │
│     nicknameFormat,  │
│     ...              │
│   }                  │
│ ]                    │
└──────────────────────┘
```

## Atomic Write Process

```
┌──────────────────────────────────────────────────────────────┐
│                     ATOMIC WRITE OPERATION                    │
└──────────────────────────────────────────────────────────────┘

                    ┌────────────────────┐
                    │ Data to write      │
                    │ (tickets, etc.)    │
                    └────────────────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Write queue check  │
                    │ for this guild     │
                    └────────────────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Wait for previous  │
                    │ operations to      │
                    │ complete           │
                    └────────────────────┘
                              │
                              ▼
                    ┌────────────────────┐
                    │ Write to           │
                    │ tickets.json.tmp   │
                    └────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
            [Write Failed]           [Write Success]
                 │                         │
                 ▼                         ▼
        ┌──────────────┐        ┌──────────────────┐
        │ Delete .tmp  │        │ Rename .tmp to   │
        │ Throw error  │        │ tickets.json     │
        └──────────────┘        │ (atomic)         │
                                └──────────────────┘
                                          │
                                          ▼
                                ┌──────────────────┐
                                │ Write complete   │
                                │ Queue continues  │
                                └──────────────────┘
```

## Guild Isolation

```
┌─────────────────────────────────────────────────────────────────┐
│                        GUILD ISOLATION                           │
└─────────────────────────────────────────────────────────────────┘

        GUILD A (123456)              GUILD B (789012)
              │                              │
              │                              │
              ▼                              ▼
    ┌──────────────────┐          ┌──────────────────┐
    │ /data/guilds/    │          │ /data/guilds/    │
    │ 123456/          │          │ 789012/          │
    │                  │          │                  │
    │ tickets.json     │    ✗     │ tickets.json     │
    │ panels.json      │   NO     │ panels.json      │
    │ transcripts.json │  ACCESS  │ transcripts.json │
    │ meta.json        │          │ meta.json        │
    └──────────────────┘          └──────────────────┘
              │                              │
              │                              │
              ▼                              ▼
    Guild A can ONLY               Guild B can ONLY
    access its own data            access its own data

    ✓ ticket-425 in Guild A  ≠  ticket-425 in Guild B
    ✓ Separate counters
    ✓ Separate configurations
    ✓ Complete isolation
```

## Error Handling Flow

```
┌──────────────────────────────────────────────────────────────┐
│                      ERROR SCENARIOS                          │
└──────────────────────────────────────────────────────────────┘

Permission Error (Create Channel)
        │
        ▼
┌─────────────────┐
│ Try/Catch block │
│ catches error   │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Log to console  │
│ Return friendly │
│ error to user   │
└─────────────────┘
        │
        ▼
Bot continues running ✓


Role Assignment Error
        │
        ▼
┌─────────────────┐
│ Try to assign   │
│ role            │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Catch error     │
│ Log it          │
│ CONTINUE anyway │
└─────────────────┘
        │
        ▼
Ticket still closes ✓


Nickname Change Error
        │
        ▼
┌─────────────────┐
│ Try to change   │
│ nickname        │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ Catch error     │
│ Log it          │
│ CONTINUE anyway │
└─────────────────┘
        │
        ▼
Ticket still closes ✓


JSON Corruption Prevention
        │
        ▼
┌─────────────────┐
│ Write to .tmp   │
└─────────────────┘
        │
        ▼
┌─────────────────┐
│ If crash occurs │
│ .tmp deleted OR │
│ old file intact │
└─────────────────┘
        │
        ▼
No data corruption ✓
```
