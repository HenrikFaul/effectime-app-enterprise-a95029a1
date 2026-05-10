# Effectime Enterprise – Folyamatábrák

<!-- METADATA -->
| Mező | Érték |
|---|---|
| Dokumentum | PROCESS_FLOWS.md |
| Generálva | 2026-05-10T12:00:00Z |
| Repozitórium | HenrikFaul/effectime-app-enterprise-a95029a1 |
| Branch | claude/create-software-documentation-O7kj1 |
| Revision | 8919c402e74e41bbe83ccf1e6385c92d0fddeada |
| Megbízhatóság | Magas (verified szabályok alapján) |
| Kapcsolódó dok. | BUSINESS_SYSTEM_REFERENCE.md, DATA_FLOW_AND_ENTITY_REFERENCE.md |

---

## Tartalomjegyzék

1. [Szabadságkérelem beküldése és jóváhagyási életciklus](#1-szabadságkérelem-beküldése-és-jóváhagyási-életciklus)
2. [Többlépéses jóváhagyási lánc](#2-többlépéses-jóváhagyási-lánc)
3. [Tag meghívása és onboarding folyamat](#3-tag-meghívása-és-onboarding-folyamat)
4. [Agile szinkronizáció (Jira/ADO)](#4-agile-szinkronizáció-jiraado)
5. [Kapacitásszámítás folyamata](#5-kapacitásszámítás-folyamata)
6. [E-mail értesítési folyamat](#6-e-mail-értesítési-folyamat)

---

## 1. Szabadságkérelem beküldése és jóváhagyási életciklus

```mermaid
flowchart TD
    A([Felhasználó: kérelem kitöltése]) --> B{Ellenőrzés - Check fázis}
    
    B --> C{Blokkoló ütközés?}
    C -- Igen: ünnepnap/tiltott nap/\npárhuzamos saját kérelem --> D[Hibaüzenet megjelenítése]
    D --> A
    
    C -- Nem --> E{Figyelmeztetés?}
    E -- Igen: max_absent túllépés\nvagy kolléga átfedés --> F[Figyelmeztetés megjelenítése]
    F --> G{Felhasználó folytatja?}
    G -- Nem --> A
    G -- Igen --> H[Submit fázis]
    
    E -- Nem --> H
    
    H --> I[(leave_requests INSERT\nstatus=pending)]
    I --> J[Értesítés küldése a jóváhagyónak]
    J --> K{Jóváhagyási döntés}
    
    K -- Jóváhagyás --> L[(status=approved)]
    K -- Elutasítás --> M[(status=rejected)]
    K -- Eszkaláció --> N[Következő jóváhagyóra átadás]
    N --> K
    
    L --> O[Értesítés kérelmezőnek: Jóváhagyva]
    M --> P[Értesítés kérelmezőnek: Elutasítva]
    
    O --> Q[Kvóta csökkentése\nenterprise_quota_transactions]
    
    L --> R{Kérelmező visszavonja?}
    R -- Igen --> S[(status=cancelled)]
    S --> T[Kvóta visszaírása]
    R -- Nem --> U([Kérelem lezárva])
    
    style A fill:#4CAF50,color:#fff
    style I fill:#2196F3,color:#fff
    style L fill:#4CAF50,color:#fff
    style M fill:#f44336,color:#fff
    style S fill:#FF9800,color:#fff
```

---

## 2. Többlépéses jóváhagyási lánc

```mermaid
flowchart TD
    A([Kérelem beküldve - status=pending]) --> B[Jóváhagyási lánc kiválasztása]
    B --> C[1. lépés jóváhagyójának értesítése]
    
    C --> D{1. lépés jóváhagyó dönt}
    D -- Elutasítás --> E[(status=rejected)]
    E --> F[Kérelmező értesítése: Elutasítva]
    
    D -- Időtúllépés --> G{Eszkalációs küszöb elérve?}
    G -- Igen --> H[Következő lépés vagy Owner értesítése]
    H --> D
    G -- Nem --> D
    
    D -- Jóváhagyás --> I{Van következő lépés?}
    I -- Igen --> J[Következő lépés jóváhagyójának értesítése]
    J --> K{Következő jóváhagyó dönt}
    K -- Elutasítás --> E
    K -- Időtúllépés --> L{Eszkaláció?}
    L -- Igen --> M[Owner értesítése]
    M --> K
    L -- Nem --> K
    K -- Jóváhagyás --> N{Van még lépés?}
    N -- Igen --> J
    N -- Nem --> O[Végső jóváhagyás]
    
    I -- Nem --> O
    O --> P[(status=approved)]
    P --> Q[Kérelmező értesítése: Jóváhagyva]
    P --> R[Kvóta csökkentése]
    
    style A fill:#2196F3,color:#fff
    style P fill:#4CAF50,color:#fff
    style E fill:#f44336,color:#fff
    style F fill:#f44336,color:#fff
```

---

## 3. Tag meghívása és onboarding folyamat

```mermaid
flowchart TD
    A([Admin: meghívó küldése]) --> B[enterprise_memberships INSERT\nstatus=invited]
    B --> C[Meghívó e-mail küldése\nsend-transactional-email]
    C --> D{Tag kap e-mailt}
    
    D --> E{Van már fiókja?}
    E -- Igen --> F[Bejelentkezés]
    E -- Nem --> G[Regisztráció Supabase Auth-ban]
    G --> F
    
    F --> H[join-event edge function meghívása]
    H --> I[enterprise_memberships UPDATE\nstatus=active]
    I --> J[Tag a munkaterületen belül]
    
    J --> K{Van onboarding sablon?}
    K -- Nem --> L([Szabad navigálás])
    K -- Igen --> M[Onboarding feladatok generálása]
    M --> N[Tag: Onboarding Inbox feladatok]
    
    N --> O{Feladat típusa}
    O -- task --> P[Feladat elvégzése]
    O -- read --> Q[Dokumentum elolvasása]
    O -- acknowledge --> R[Visszaigazolás]
    O -- training --> S[Képzés elvégzése]
    O -- exam --> T[Vizsga]
    O -- approval --> U[Admin jóváhagyása szükséges]
    O -- internal_permission --> V[Belső jogosultság kiadása]
    O -- external_access --> W[Külső rendszer hozzáférés kiadása]
    
    P & Q & R & S & T --> X{Minden lépés kész?}
    U --> Y{Admin jóváhagyja?}
    Y -- Igen --> X
    Y -- Nem --> Z[Feladat elutasítva]
    V & W --> X
    
    X -- Igen --> AA([Onboarding befejezve])
    X -- Nem --> N
    
    style A fill:#4CAF50,color:#fff
    style I fill:#2196F3,color:#fff
    style AA fill:#4CAF50,color:#fff
```

---

## 4. Agile szinkronizáció (Jira/ADO)

```mermaid
flowchart LR
    subgraph external [Külső rendszerek]
        J[Jira Cloud\nOAuth]
        A[Azure DevOps\nPAT token]
    end
    
    subgraph edge [Edge Functions - Supabase]
        P[jira-devops-proxy]
    end
    
    subgraph db [Adatbázis]
        T[(enterprise_agile_issues)]
    end
    
    subgraph fe [Frontend]
        AP[AgilePanel]
        KB[Kanban/Scrum/Gantt]
        CF[CapacityFit]
        BB[BacklogBrowser]
        JE[JiraIssueEditor]
    end
    
    J -- OAuth API hívás --> P
    A -- PAT API hívás --> P
    P -- Szinkronizáció --> T
    T -- TanStack Query --> AP
    AP --> KB
    AP --> CF
    AP --> BB
    KB --> JE
    JE -- Writeback kérés --> P
    P -- API --> J
    P -- API --> A
    
    style P fill:#FF9800,color:#fff
    style T fill:#2196F3,color:#fff
```

---

## 5. Kapacitásszámítás folyamata

```mermaid
flowchart TD
    A([Kapacitás-lekérdezés]) --> B[Tagok adatainak betöltése\nenterprise_memberships]
    B --> C[Projektek és allokációk betöltése\nenterprise_projects]
    C --> D[Szabadságok betöltése\nleave_requests - approved]
    D --> E[Ünnepnapok betöltése\nenterprise_holidays]
    
    E --> F{Minden tag}
    F --> G[Elérhető napok számítása\nAlap munkaidő - Szabadság - Ünnepnap]
    G --> H[Kapacitás számítása\nhours = base_working_hours × allocation_pct / 100]
    H --> I[Hiány számítása\nshortage_score = FTE_required - FTE_available]
    
    I --> J{Megjelenítési nézet}
    J -- ResourceDashboard --> K[Összesített kapacitás kártya]
    J -- UtilizationHeatmap --> L[Hőtérkép\nszín = kihasználtság %]
    J -- CapacityGapReport --> M[Hiányjelentés]
    J -- CapacityFit --> N[Sprint kapacitás illeszkedés]
    J -- CapacityDnaPanel --> O[Workspace DNA összesítő]
    J -- SkillCapacityReport --> P[Készség-szintű kapacitás]
    
    style A fill:#4CAF50,color:#fff
    style H fill:#2196F3,color:#fff
    style I fill:#FF9800,color:#fff
```

---

## 6. E-mail értesítési folyamat

```mermaid
flowchart TD
    subgraph triggers [Esemény indítók]
        T1[Szabadságkérelem beküldve]
        T2[Kérelem jóváhagyva]
        T3[Kérelem elutasítva]
        T4[Meghívó küldése]
        T5[Ütemezett riport]
        T6[Eszkaláció]
    end
    
    subgraph queue [E-mail sor]
        EQ[(email_queue tábla)]
    end
    
    subgraph ef [Edge Functions]
        STE[send-transactional-email\nResend/SMTP]
        PEQ[process-email-queue\ncron]
        AEH[auth-email-hook\nSup. Auth hook]
        SSR[send-scheduled-reports]
    end
    
    subgraph recipient [Címzett]
        R[Felhasználó e-mail]
    end
    
    T1 -- Jóváhagyó értesítés --> EQ
    T2 -- Kérelmező értesítés --> EQ
    T3 -- Kérelmező értesítés --> EQ
    T4 -- Meghívó e-mail --> AEH
    T5 -- Riport tartalom --> SSR
    T6 -- Eszkalált jóváhagyó --> EQ
    
    EQ -- Cron drain --> PEQ
    PEQ --> STE
    AEH --> STE
    SSR --> STE
    STE --> R
    
    subgraph suppression [Elnyomás]
        HS[handle-email-suppression]
        HU[handle-email-unsubscribe]
    end
    
    STE -- Leiratkozás kezelés --> HU
    HU --> HS
    HS -- Tiltólista --> STE
    
    style EQ fill:#2196F3,color:#fff
    style STE fill:#4CAF50,color:#fff
```
