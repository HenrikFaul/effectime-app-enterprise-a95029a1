// Hungarian translation bundle. Mirrors the English bundle structure.
// Missing keys fall back to English at runtime.

const hu = {
  common: {
    save: 'Mentés',
    saving: 'Mentés…',
    cancel: 'Mégse',
    edit: 'Szerkesztés',
    delete: 'Törlés',
    archive: 'Archiválás',
    create: 'Létrehozás',
    add: 'Hozzáadás',
    search: 'Keresés',
    loading: 'Betöltés…',
    empty: 'Nincs rekord',
    yes: 'Igen',
    no: 'Nem',
    back: 'Vissza',
    close: 'Bezárás',
    open: 'Megnyitás',
    confirm: 'Megerősítés',
    name: 'Név',
    description: 'Leírás',
    actions: 'Műveletek',
    status: 'Állapot',
    created: 'Létrehozva',
    updated: 'Frissítve',
    optional: 'opcionális',
    required: 'kötelező',
  },
  header: {
    help: 'Súgó',
    open_help: 'Súgó megnyitása',
    language: 'Nyelv',
    select_language: 'Válassz nyelvet',
    notifications: 'Értesítések',
    profile: 'Profil',
    sign_out: 'Kilépés',
    new_workspace: 'Új munkaterület',
  },
  help: {
    drawer_title: 'Súgó',
    drawer_subtitle: 'Helyzetfüggő útmutató az aktuális oldalhoz.',
    no_anchor_title: 'Súgó',
    no_anchor_summary:
      'Nyiss meg egy oldalt és nyisd meg újra ezt a panelt a kontextusra szabott útmutatóért, gyakori feladatokért és billentyűparancsokért.',
    common_tasks: 'Gyakori feladatok',
    keyboard_shortcuts: 'Billentyűparancsok',
    related: 'Kapcsolódó',
    open_manual: 'Teljes kézikönyv megnyitása',
    section_label: 'Szakasz',
    anchors: {
      'home.overview': {
        title: 'Munkaterületek',
        summary:
          'Ez a munkaterület-választó. Minden munkaterület egy izolált szervezet a saját tagjaival, távolléti szabályaival és riportjaival. Kattints egy munkaterületre a belépéshez.',
        commonTasks: [
          'Új munkaterület létrehozása',
          'Meglévő munkaterület megnyitása',
          'Kilépés',
          'Nyelv váltása',
        ],
      },
      'workspace.members': {
        title: 'Tagok',
        summary:
          'Kezeld a munkaterület tagjait. Innen meghívhatsz új tagokat, szerkesztheted a szerepköröket és pozíciókat, megtekintheted az engedélyeket, és megnyithatod a profilokat.',
        commonTasks: [
          'Új tag meghívása',
          'Tag profil megnyitása',
          'Szerep-hozzárendelés szerkesztése',
          'Szűrés csapat vagy iroda szerint',
        ],
      },
      'workspace.organization': {
        title: 'Szervezet',
        summary:
          'A Szervezet modul a hierarchia, vezetői szintek, szerződéses viszonyok, iparági besorolás, munkakategóriák és munkacsaládok hivatalos forrása. A szervezeti diagram ezekből generálódik.',
        commonTasks: [
          'Szervezeti egységek és hierarchia definiálása',
          'Szerződéstípusok kezelése',
          'Vezetői szintek konfigurálása',
          'Automatikusan generált szervezeti diagram megtekintése',
        ],
      },
      'workspace.calendar': {
        title: 'Naptár',
        summary:
          'Tekintsd át a távolléteket, lefedettséget és kapacitást a csapaton belül. Válts naptári, éves, idővonal és lefedettség-tervező nézet között.',
        commonTasks: [
          'Távollét kérelem beadása',
          'Függőben lévő kérelmek jóváhagyása vagy elutasítása',
          'Nézetváltás (távollét / éves / idővonal / lefedettség)',
          'Szűrők alkalmazása',
        ],
      },
      'workspace.approvals': {
        title: 'Jóváhagyások',
        summary:
          'A jóváhagyási inbox listázza az összes döntésre váró távollét-, onboarding- és hozzáférés-kérelmet. A döntések megváltoztathatatlan audit napló bejegyzést kapnak.',
      },
      'workspace.workflows': {
        title: 'Folyamatok',
        summary:
          'Onboarding playbookok és külső hozzáférés-kérelmek. A sablonok verziózottak; az instanszok tagonként követik a haladást; a hozzáférés-kérelmek a meglévő jóváhagyási motoron keresztül futnak.',
        commonTasks: [
          'Onboarding sablon létrehozása vagy publikálása',
          'Onboarding indítása új tagra',
          'Külső hozzáférési rendszerek hozzáadása',
          'Függő hozzáférés-kérelmek jóváhagyása vagy elutasítása',
        ],
      },
      'settings.localization': {
        title: 'Nyelvi beállítások',
        summary:
          'Az Effectime támogatja az angolt és a magyart. A felhasználó által választott nyelv a profilba kerül mentésre és a felület valamint a kimenő emailek is ezt használják. További nyelvek később, kódváltoztatás nélkül adhatók hozzá.',
        commonTasks: [
          'Nyelv váltása a fejlécbeli zászlóval',
          'Munkaterület alapnyelvének beállítása (admin)',
          'Hiányzó kulcsok áttekintése',
        ],
      },
    } as Record<
      string,
      {
        title: string;
        summary: string;
        commonTasks?: string[];
        keyboardShortcuts?: { combo: string; description: string }[];
      }
    >,
  },
  organization: {
    title: 'Szervezet',
    subtitle: 'Hierarchia, vezetés, szerződések és automatikusan generált szervezeti diagram.',
    tabs: {
      structure: 'Felépítés',
      leadership: 'Vezetés',
      contracts: 'Szerződések',
      industry: 'Iparág',
      categories: 'Munkakategóriák',
      job_families: 'Munkacsaládok',
      chart: 'Szervezeti diagram',
    },
    structure: {
      title: 'Szervezeti felépítés',
      description:
        'Definiáld a szervezeti egységek hierarchiáját (divíziók, osztályok, csapatok). A szervezeti diagram a vezetői kapcsolatokból és ezekből az egységekből generálódik.',
      add_unit: 'Egység hozzáadása',
      unit_name: 'Egység neve',
      parent_unit: 'Szülő egység',
      no_parent: '(legfelső szint)',
      empty: 'Még nincs egység. Add hozzá az első szervezeti egységet.',
    },
    leadership: {
      title: 'Vezetői szintek',
      description:
        'Definiáld a szervezetben használt vezetői kategóriákat (stratégiai, operatív, technikai, végrehajtó). A tagok a profiljukon kapnak besorolást.',
      add_level: 'Szint hozzáadása',
      level_label: 'Megjelenítés',
      level_code: 'Kód',
      sort_order: 'Sorrend',
    },
    contracts: {
      title: 'Szerződéses viszonyok',
      description:
        'Definiáld a tag-felvételnél használható szerződéstípusokat (alkalmazott, vállalkozó, alvállalkozó, kölcsönzött, tanácsadó, határozott idejű, egyéni).',
      add_type: 'Szerződéstípus hozzáadása',
      seeded: 'Alapértelmezett kínálat',
    },
    industry: {
      title: 'Iparági besorolás',
      description: 'Válaszd ki a munkaterületet leíró iparágat / tevékenységi területet.',
      add: 'Iparág hozzáadása',
    },
    categories: {
      title: 'Munkakategóriák',
      description: 'Kontrollált szótár pozíciók, projektek és onboarding-sablonok besorolásához.',
      add: 'Kategória hozzáadása',
    },
    job_families: {
      title: 'Munkacsaládok',
      description: 'Rokon pozíciók csoportosítása analitikához és onboarding-sablonok öröklődéséhez.',
      add: 'Család hozzáadása',
    },
    chart: {
      title: 'Szervezeti diagram',
      description:
        'A munkaterületen belüli vezetői kapcsolatokból generálva. A keresővel egy alfára szűkítheted a nézetet.',
      regenerate: 'Pillanatkép újragenerálása',
      no_manager: 'Nincs vezető',
      members: 'tag',
      no_data: 'Még nincs tagi adat. Hívj meg tagokat a diagramhoz.',
    },
  },
  positions: {
    catalog_title: 'Előre definiált pozíció-katalógus',
    catalog_description:
      'Válassz a katalógusból, vagy maradj az egyéni szövegnél. Katalógus választása esetén ajánlott skill-elvárások csatolódnak.',
    custom_path: 'Egyéni címke használata',
    catalog_path: 'Választás katalógusból',
    pick_category: 'Válassz kategóriát',
    pick_role: 'Válassz pozíciót',
    review_skills: 'Ajánlott skillek áttekintése',
    seniority: 'Szenioritás',
    seniority_levels: {
      junior: 'Junior',
      medior: 'Medior',
      senior: 'Senior',
      lead: 'Lead',
      principal: 'Principal',
    },
    apply: 'Választás alkalmazása',
    inherited: 'Örökölt',
    manual: 'Manuális',
  },
  member: {
    org_unit: 'Szervezeti egység',
    manager: 'Közvetlen vezető',
    leadership_level: 'Vezetői szint',
    leadership_category: 'Vezetői kategória',
    contract_type: 'Szerződéstípus',
    employer_rights: 'Munkáltatói jogkör',
    completion_banner_title: 'Szervezeti adatok hiányosak',
    completion_banner_body:
      'Ennél a tagnál hiányzik egy vagy több új kötelező mező (vezető, szervezeti egység, szerződéstípus, vezetői szint). A meglévő adatok megmaradnak; ha van rá idő, töltsd ki a profilt.',
    leadership_categories: {
      strategic: 'Stratégiai',
      operational: 'Operatív',
      technical: 'Technikai',
      execution: 'Végrehajtó',
      none: 'Nem releváns',
    },
  },
  settings: {
    localization: {
      title: 'Nyelvi beállítások',
      description:
        'Az Effectime jelenleg angolt és magyart támogat. Minden felhasználó felülírhatja a munkaterület alapnyelvét a fejléc zászlójával.',
      languages: 'Nyelvek',
      enabled: 'Engedélyezve',
      default: 'Alapértelmezett',
      missing_keys: 'Hiányzó kulcsok',
      none_missing: 'Nincs hiányzó kulcs.',
      missing_count: '{{count}} hiányzó kulcs',
      workspace_default: 'Munkaterület alapnyelve',
      configure_default: 'A munkaterület alapnyelve egy későbbi kiadásban lesz konfigurálható.',
      export_csv: 'CSV exportálás',
      import_csv: 'CSV importálás',
      import_help:
        'Tölts fel egy CSV-t a következő oszlopokkal: key, en, hu. A meglévő kulcsok csak ebben a munkamenetben frissülnek — a fájlformátum a fordítók számára kanonikus csereformátum.',
      import_summary: '{{added}} új · {{updated}} frissítve · {{skipped}} kihagyva',
      persisted: 'Fordítási felülírások mentve a munkaterületbe.',
    },
    recovery: {
      title: 'Recovery üzemmód',
      description:
        'Aktiváld, ha kritikus küszöb sérül. A Recovery üzemmód irányított akciókat és prioritást ad a parancsközpontnak.',
      activate: 'Recovery üzemmód aktiválása',
      deactivate: 'Recovery üzemmód kikapcsolása',
      reason: 'Aktiválás oka',
      active_since: 'Aktív óta',
      reason_placeholder: 'pl. kritikus lefedettségi hiány a fejlesztésben jövő héten',
    },
  },
  workflows: {
    title: 'Folyamatok',
    subtitle: 'Onboarding playbookok és külső hozzáférés-kérelmek.',
    tabs: {
      onboarding_templates: 'Onboarding sablonok',
      onboarding_inbox: 'Onboarding inbox',
      access_systems: 'Hozzáférési rendszerek',
      access_templates: 'Hozzáférési sablonok',
      access_inbox: 'Hozzáférési inbox',
    },
  },
  onboarding: {
    template_name: 'Sablon neve',
    add_template: 'Sablon hozzáadása',
    publish: 'Publikálás',
    draft: 'Piszkozat',
    published: 'Publikált',
    archived: 'Archivált',
    add_step: 'Lépés hozzáadása',
    step_title: 'Lépés címe',
    step_type: 'Típus',
    owner_role: 'Felelős szerep',
    due_offset: 'Határidő (nap)',
    mandatory: 'Kötelező',
    escalate_after: 'Eszkaláció (nap után)',
    instances_title: 'Onboarding folyamatban',
    no_instances: 'Jelenleg nincs aktív onboarding.',
    start_for_member: 'Onboarding indítása tagra',
    member: 'Tag',
    template: 'Sablon',
    progress: 'Haladás',
    types: {
      task: 'Feladat',
      read: 'Elolvasás',
      acknowledge: 'Tudomásulvétel',
      training: 'Képzés',
      exam: 'Vizsga',
      approval: 'Jóváhagyás',
      internal_permission: 'Belső jogosultság',
      external_access: 'Külső hozzáférés',
    },
  },
  access: {
    systems_title: 'Hozzáférési rendszerek',
    systems_description:
      'Külső és belső rendszerek, melyek hozzáférését Effectime sablonok és jóváhagyások irányítják.',
    add_system: 'Rendszer hozzáadása',
    seed_systems: 'Alapértelmezések betöltése (Jira / Confluence / Outlook / stb.)',
    kind_internal: 'Belső',
    kind_external: 'Külső',
    templates_title: 'Hozzáférési sablonok',
    templates_description:
      'Pozíciókra szabott rendszer-csomagok, melyek hozzáférése kötelező vagy opcionális. Onboardingban és ad-hoc kérelmeknél használatos.',
    add_template: 'Sablon hozzáadása',
    requests_title: 'Hozzáférés-kérelmek inbox',
    requests_description:
      'Folyamatban lévő és lezárt hozzáférés-kérelmek. A döntések megváltoztathatatlan rekordot képeznek az `enterprise_access_decisions` táblában.',
    request: 'Hozzáférés kérése',
    submit_for_member: 'Beadás tag nevében',
    member: 'Tag',
    system: 'Rendszer',
    reason: 'Indoklás',
    statuses: {
      pending: 'Függőben',
      approved: 'Jóváhagyva',
      provisioning: 'Provizionálás',
      granted: 'Megadva',
      rejected: 'Elutasítva',
      revoked: 'Visszavonva',
      cancelled: 'Lemondva',
    },
    actions: {
      approve: 'Jóváhagyás',
      reject: 'Elutasítás',
      revoke: 'Visszavonás',
      cancel: 'Lemondás',
      mark_granted: 'Megadottnak jelölés',
    },
    no_requests: 'Még nincs hozzáférés-kérelem.',
  },
  command: {
    title: 'Parancsközpont',
    subtitle: 'Akciósor a munkaterületen.',
    pending_approvals: 'Függő jóváhagyások',
    pending_onboarding: 'Folyamatban lévő onboarding',
    pending_access: 'Függő hozzáférés-kérelmek',
    organization_completion: 'Hiányos szervezeti adattal rendelkező tagok',
    recovery_active: 'Recovery üzemmód AKTÍV',
    recovery_inactive: 'A működés normál',
    open: 'Megnyitás',
  },
  decision: {
    memory_title: 'Döntésmemória',
    rationale: 'Indoklás',
    expected: 'Várt eredmény',
    observed: 'Megfigyelt eredmény',
    save: 'Memo mentése',
    saved: 'Memo mentve',
    placeholder_rationale: 'Miért hozzuk meg ezt a döntést?',
    placeholder_expected: 'Milyen eredményre számítunk?',
    placeholder_observed: 'Mi történt valójában? (későbbi kitöltés)',
    stale_inbox_title: 'Megfigyelt eredmény — rögzítés szükséges',
    stale_inbox_description:
      'Olyan döntések, melyek megfigyelési ablaka lejárt. Rögzítsd a megfigyelt eredményt, hogy a tanulási kör záruljon.',
    no_stale: 'Nincs megfigyelésre váró döntés.',
    days_overdue: '{{count}} napja esedékes',
    capture_observed: 'Megfigyelt eredmény rögzítése',
  },
  pulse: {
    title: 'Org Pulse',
    subtitle: 'Privacy-safe operatív jelek (k ≥ 5).',
    suppressed: 'Elrejtve — kevesebb mint 5 rekord',
    active_members: 'Aktív tagok',
    employer_rights: 'Munkáltatói jogkörrel',
    missing_org_unit: 'Hiányzó szervezeti egység',
    missing_manager: 'Hiányzó vezető',
    missing_contract: 'Hiányzó szerződés',
    missing_leadership: 'Hiányzó vezetői szint',
    open_approvals_long: '48 órán túli függő jóváhagyás',
    weekly_leave: 'Jóváhagyott távollét (utolsó 7 nap)',
  },
  capacity: {
    title: 'Kapacitás DNA',
    subtitle:
      'Napi pillanatképek: alap / elérhető / hiány / túlterhelés jelek. Az előrejelző motor alapja.',
    generate: 'Mai pillanatkép generálása',
    generated: 'Pillanatkép elmentve',
    snapshot_date: 'Dátum',
    baseline_fte: 'Alap FTE',
    effective_fte: 'Effektív FTE',
    available_fte: 'Elérhető FTE',
    shortage_score: 'Hiány',
    overload_score: 'Túlterhelés',
    no_snapshots: 'Még nincs pillanatkép. Indíts egy generálást.',
    note:
      'Szabályalapú v1: alap = aktív tagok; effektív = alap mínusz adott napi jóváhagyott távollét; shortage_score = max(0, committed − effektív) / alap.',
  },
  integration_health: {
    title: 'Integrációs egészségközpont',
    subtitle:
      'Integrációnkénti utolsó szinkron-állapot a sync naplóból kiemelt hibarészletekkel.',
    healthy: 'Egészséges',
    degraded: 'Romlott',
    failed: 'Sikertelen',
    no_integrations: 'Nincs konfigurált integráció.',
    no_sync_log: 'Ehhez az integrációhoz nincs napló-bejegyzés.',
    last_sync: 'Utolsó szinkron',
    success: 'Sikeres',
    error: 'Hiba',
  },
} as const;

export default hu;
