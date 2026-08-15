/*
╔══════════════════════════════════════════════╗
║          𝑱𝑶𝑬𝑳 𝑻𝑶𝑴_𝑩𝑶𝑻 v2.0.0             ║
║              © 2026 JOEL TOM TECH            ║
╚══════════════════════════════════════════════╝

INSTALLATION :

npm init -y
npm install @whiskeysockets/baileys qrcode-terminal pino dotenv pg

ENV :

OWNER_NUMBER=237654145540
GEMINI_API_KEY=TA_CLE_GEMINI
POSTGRES_URL=postgresql://user:password@host:5432/database
POSTGRES_SYNC_INTERVAL=60

LANCER :

node index.js
*/

require('dotenv').config()

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    delay
} = require('@whiskeysockets/baileys')

const qrcode = require('qrcode-terminal')
const pino = require('pino')
const fs = require('fs')
const { Pool } = require('pg')

/* =====================================================
   CONFIGURATION
===================================================== */

const PREFIX = '.'

const OWNER_NUMBER =
    String(process.env.OWNER_NUMBER || '')
        .replace(/[^0-9]/g, '')

const OWNER =
    '𝑱𝑶𝑬𝑳 𝑻𝑶𝑴_𝑻𝑬𝑪𝑯'

const BOTNAME =
    '𝑱𝑶𝑬𝑳 𝑻𝑶𝑴_𝑩𝑶𝑻'

const VERSION =
    'v2.0.0'

const SIGNATURE =
    '> BY : © 2026 𝑱𝑶𝑬𝑳 𝑻𝑶𝑴_𝑻𝑬𝑪𝑯'

const LOGO_PATH =
    './logo.jpg'

const PING_BANNIERE =
    'https://i.imgur.com/8KmE1wD.jpg'

const DATA_DIR =
    './data'

const DB_FILE =
    './data/database.json'

const SESSION_DIR =
    './session'

const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY || ''

const POSTGRES_URL =
    process.env.POSTGRES_URL || ''

const POSTGRES_SYNC_INTERVAL =
    Math.min(
        300,
        Math.max(
            20,
            Number(
                process.env.POSTGRES_SYNC_INTERVAL || 60
            )
        )
    )

/* =====================================================
   DOSSIERS
===================================================== */

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    })
}

/* =====================================================
   BASE DE DONNÉES
===================================================== */

const DEFAULT_DB = {

    sudo: [],

    antiLink: {},

    welcome: {},

    restrictedGroups: [],

    allowGroups: [],

    globalRestrict: false,

    gemini: {
        enabled: false,

        model:
            'gemini-2.0-flash',

        delay: 10,

        prompt:
            'Tu es 𝑱𝑶𝑬𝑳 𝑻𝑶𝑴_𝑩𝑶𝑻, un assistant utile, intelligent, respectueux et précis.',

        memory: {}
    },

    channelFilters: {},

    schedules: [],

    channelDefault: {}

}

let db = null

function loadDatabase() {

    if (!fs.existsSync(DB_FILE)) {

        fs.writeFileSync(
            DB_FILE,
            JSON.stringify(
                DEFAULT_DB,
                null,
                2
            )
        )
    }

    try {

        db = JSON.parse(
            fs.readFileSync(
                DB_FILE,
                'utf8'
            )
        )

    } catch {

        db =
            JSON.parse(
                JSON.stringify(
                    DEFAULT_DB
                )
            )

        saveLocalDatabase()
    }

    /* Protection contre les anciennes bases */

    db.sudo ??= []

    db.antiLink ??= {}

    db.welcome ??= {}

    db.restrictedGroups ??= []

    db.allowGroups ??= []

    db.globalRestrict ??= false

    db.gemini ??= {}

    db.gemini.enabled ??= false

    db.gemini.model ??=
        'gemini-2.0-flash'

    db.gemini.delay ??= 10

    db.gemini.prompt ??=
        'Tu es 𝑱𝑶𝑬𝑳 𝑻𝑶𝑴_𝑩𝑶𝑻, un assistant utile et respectueux.'

    db.gemini.memory ??= {}

    db.channelFilters ??= {}

    db.schedules ??= []

    db.channelDefault ??= {}
}

function saveLocalDatabase() {

    fs.writeFileSync(
        DB_FILE,
        JSON.stringify(
            db,
            null,
            2
        )
    )
}

/* =====================================================
   POSTGRESQL
===================================================== */

let pgPool = null

let postgresEnabled = false

async function initPostgres() {

    if (!POSTGRES_URL) {

        console.log(
            'ℹ️ [PG-Sync] PostgreSQL désactivé.'
        )

        return
    }

    try {

        pgPool = new Pool({
            connectionString:
                POSTGRES_URL,

            ssl: {
                rejectUnauthorized: false
            }
        })

        await pgPool.query(`
            CREATE TABLE IF NOT EXISTS bot_storage (
                id INTEGER PRIMARY KEY,
                data JSONB NOT NULL,
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `)

        postgresEnabled = true

        console.log(
            '☁️ [PG-Sync] Connected successfully.'
        )

    } catch (error) {

        postgresEnabled = false

        console.log(
            '⚠️ [PG-Sync] Connexion PostgreSQL impossible.'
        )

        console.log(
            'ℹ️ Le bot continue avec database.json.'
        )
    }
}

async function savePostgres() {

    if (
        !postgresEnabled ||
        !pgPool
    ) {
        return
    }

    try {

        await pgPool.query(
            `
            INSERT INTO bot_storage
            (id, data, updated_at)
            VALUES (1, $1, NOW())

            ON CONFLICT (id)

            DO UPDATE SET
                data = EXCLUDED.data,
                updated_at = NOW()
            `,
            [db]
        )

    } catch (error) {

        console.log(
            '⚠️ [PG-Sync] Sauvegarde échouée :',
            error.message
        )
    }
}

async function restorePostgres() {

    if (
        !postgresEnabled ||
        !pgPool
    ) {
        return
    }

    try {

        const result =
            await pgPool.query(
                `
                SELECT data
                FROM bot_storage
                WHERE id = 1
                `
            )

        if (
            result.rows.length > 0 &&
            result.rows[0].data
        ) {

            db = {
                ...db,
                ...result.rows[0].data
            }

            saveLocalDatabase()

            console.log(
                '☁️ [PG-Sync] Database restored.'
            )

        } else {

            await savePostgres()

            console.log(
                '☁️ [PG-Sync] Initial backup created.'
            )
        }

    } catch (error) {

        console.log(
            '⚠️ [PG-Sync] Restauration impossible :',
            error.message
        )
    }
}

function startPostgresSync() {

    setInterval(
        async () => {

            try {

                saveLocalDatabase()

                await savePostgres()

            } catch (error) {

                console.log(
                    '⚠️ [PG-Sync] AutoSync :',
                    error.message
                )
            }

        },
        POSTGRES_SYNC_INTERVAL * 1000
    )

    console.log(
        `🔄 [PG-Sync] Intervalle : ${POSTGRES_SYNC_INTERVAL}s`
    )
}

async function saveDatabase() {

    saveLocalDatabase()

    await savePostgres()
}

/* =====================================================
   OUTILS
===================================================== */

function format(text) {

    return (
        '> ' +
        String(text)
            .split('\n')
            .join('\n> ')
    )
}

function getNumber(jid) {

    return String(jid || '')
        .split('@')[0]
        .split(':')[0]
        .replace(/[^0-9]/g, '')
}

function isOwner(sender) {

    if (!OWNER_NUMBER)
        return false

    return (
        getNumber(sender) ===
        OWNER_NUMBER
    )
}

function isSudo(sender) {

    return db.sudo.includes(
        getNumber(sender)
    )
}

function isOwnerOrSudo(sender) {

    return (
        isOwner(sender) ||
        isSudo(sender)
    )
}

function getMessageText(mek) {

    return (
        mek.message?.conversation ||

        mek.message
            ?.extendedTextMessage
            ?.text ||

        mek.message
            ?.imageMessage
            ?.caption ||

        mek.message
            ?.videoMessage
            ?.caption ||

        ''
    )
}

function getMentioned(mek) {

    return (
        mek.message
            ?.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid ||

        []
    )
}

async function getGroupMetadata(
    conn,
    from
) {

    return await conn.groupMetadata(
        from
    )
}

function isAdmin(
    metadata,
    jid
) {

    const participant =
        metadata.participants.find(
            p => p.id === jid
        )

    return (
        participant?.admin === 'admin' ||
        participant?.admin === 'superadmin'
    )
}

/* =====================================================
   PERMISSIONS GROUPE
===================================================== */

async function canUseGroupCommands(
    conn,
    from,
    sender
) {

    if (!from.endsWith('@g.us'))
        return false

    if (isOwnerOrSudo(sender))
        return true

    if (
        db.globalRestrict &&
        !db.allowGroups.includes(from)
    ) {
        return false
    }

    if (
        db.restrictedGroups.includes(from)
    ) {
        return false
    }

    try {

        const metadata =
            await getGroupMetadata(
                conn,
                from
            )

        return isAdmin(
            metadata,
            sender
        )

    } catch {

        return false
    }
}

/* =====================================================
   MENUS
===================================================== */

function getMenu() {

    return format(`
╭─❒ 「 ${BOTNAME} 」 ❒
│
│ 👑 OWNER : ${OWNER}
│ 📦 VERSION : ${VERSION}
│ ⚡ PREFIX : ${PREFIX}
│ 🤖 IA : Gemini
│ 🌍 MODE : Public
│ ☁️ PG-SYNC : ${postgresEnabled ? 'ON' : 'OFF'}
│
╰──────────────❒

╭─❒ 「 SYSTEME 」 ❒
│ ➟ ${PREFIX}menu
│ ➟ ${PREFIX}aide
│ ➟ ${PREFIX}ping
│ ➟ ${PREFIX}info
│ ➟ ${PREFIX}jid
│ ➟ ${PREFIX}gmenu
│ ➟ ${PREFIX}pmenu
│ ➟ ${PREFIX}help <commande>
╰──────────────❒

╭─❒ 「 ADMIN GROUPE 」 ❒
│ ➟ ${PREFIX}open
│ ➟ ${PREFIX}close
│ ➟ ${PREFIX}kick @tag
│ ➟ ${PREFIX}tagall
│ ➟ ${PREFIX}add <numero>
│ ➟ ${PREFIX}welcome on/off
│ ➟ ${PREFIX}antilink on/off
╰──────────────❒

╭─❒ 「 GPERM 」 ❒
│ ➟ ${PREFIX}gperm disable
│ ➟ ${PREFIX}gperm allow
│ ➟ ${PREFIX}gperm show
│ ➟ ${PREFIX}gperm global on/off
│ ➟ ${PREFIX}gperm except add
│ ➟ ${PREFIX}gperm except remove
╰──────────────❒

╭─❒ 「 GEMINI IA 」 ❒
│ ➟ ${PREFIX}gemini on
│ ➟ ${PREFIX}gemini off
│ ➟ ${PREFIX}gemini <question>
│ ➟ ${PREFIX}gemini model <nom>
│ ➟ ${PREFIX}gemini delay <secondes>
│ ➟ ${PREFIX}gemini prompt <texte>
│ ➟ ${PREFIX}gemini clear <numero>
╰──────────────❒

╭─❒ 「 SUDO 」 ❒
│ ➟ ${PREFIX}sudo add <numero>
│ ➟ ${PREFIX}sudo list
│ ➟ ${PREFIX}sudo rm <numero/index>
│ ➟ ${PREFIX}sudo rm tout
╰──────────────❒

╭─❒ 「 CHANNEL 」 ❒
│ ➟ ${PREFIX}chflt
│ ➟ ${PREFIX}delchflt
│ ➟ ${PREFIX}chflist
│ ➟ ${PREFIX}chdefault
│ ➟ ${PREFIX}chsched
╰──────────────❒

${SIGNATURE}`)
}

function getGroupMenu() {

    return format(`
╭─❒ 「 GROUPE 」 ❒
│
│ ${PREFIX}open
│ Ouvre le groupe.
│
│ ${PREFIX}close
│ Ferme le groupe.
│
│ ${PREFIX}kick @tag
│ Expulse un membre.
│
│ ${PREFIX}tagall
│ Mentionne tous les membres.
│
│ ${PREFIX}add <numero>
│ Ajoute un membre.
│
│ ${PREFIX}welcome on/off
│ Active le message de bienvenue.
│
│ ${PREFIX}antilink on/off
│ Active l'anti-lien.
│
│ ${PREFIX}gperm disable
│ Restreint le groupe.
│
╰──────────────❒
${SIGNATURE}`)
}

function getPrivateMenu() {

    return format(`
╭─❒ 「 PRIVÉ 」 ❒
│
│ ${PREFIX}gemini
│ Assistant IA Gemini.
│
│ ${PREFIX}sudo
│ Gestion Sudo.
│
│ ${PREFIX}jid
│ Affiche le JID.
│
│ ${PREFIX}help
│ Documentation.
│
╰──────────────❒
${SIGNATURE}`)
}

/* =====================================================
   HELP
===================================================== */

const HELP = {

    gemini: `
🤖 GEMINI — ASSISTANT IA

.gemini on
Active Gemini.

.gemini off
Désactive Gemini.

.gemini Explique JavaScript simplement.
Pose une question directement.

.gemini model gemini-2.0-flash
Change le modèle.

.gemini delay 10
Définit le délai.

.gemini prompt Tu es très bref.
Change la personnalité.

.gemini clear 237XXXXXXXXX
Efface la mémoire.

🔒 Privé uniquement.
👑 Owner/Sudo.
`,

    sudo: `
🔐 GESTION SUDO

.sudo add 237654145540
Ajoute un Sudo.

.sudo list
Liste les Sudo.

.sudo rm 237654145540
Supprime un Sudo.

.sudo rm 2
Supprime le Sudo numéro 2.

.sudo rm tout
Supprime tous les Sudo.

👑 Owner uniquement pour modifier.
`,

    gperm: `
🔒 GROUP PERMISSIONS

.gperm disable
Restreint le groupe.

.gperm allow
Autorise les admins.

.gperm show
Liste les groupes restreints.

.gperm global on
Active la restriction globale.

.gperm global off
Désactive la restriction globale.

.gperm except add
Ajoute une exception.

.gperm except remove
Supprime une exception.

.gperm except list
Liste les exceptions.
`,

    jid: `
🆔 JID

.jid

Affiche le JID de la conversation actuelle.
`,

    antilink: `
🛡️ ANTILINK

.antilink on
Active l'anti-lien.

.antilink off
Désactive l'anti-lien.

Les liens WhatsApp envoyés par les membres
non-admin peuvent être supprimés et le membre
peut être expulsé si le bot est administrateur.
`,

    add: `
👥 AJOUT DE MEMBRES

.add 237XXXXXXXXX

Vous pouvez ajouter plusieurs numéros :

.add 237XXXXXXXXX 237YYYYYYYYY

Le bot et l'utilisateur doivent avoir les
permissions nécessaires dans le groupe.
`,

    chflt: `
📢 FILTRE CANAL

.chflt bonjour, salut ! Salut 👋

.chflist
Liste les filtres.

.delchflt bonjour
Supprime un filtre.

.chdefault <JID>
Définit le canal par défaut.
`,

    chsched: `
⏰ PLANIFICATEUR

.chsched once 2026-12-25|10:00 Joyeux Noël

.chsched in 2h La réunion commence.

.chsched list
Liste les publications.

.chsched rm <ID>
Supprime une publication.

.chsched rm tout
Supprime les publications de l'utilisateur.
`
}

/* =====================================================
   GEMINI
===================================================== */

async function askGemini(
    user,
    question
) {

    if (!GEMINI_API_KEY) {

        throw new Error(
            'GEMINI_API_KEY non configurée dans .env'
        )
    }

    if (!db.gemini.memory[user]) {

        db.gemini.memory[user] = []
    }

    const history =
        db.gemini.memory[user]
            .slice(-15)

    const contents = []

    for (
        const item of history
    ) {

        contents.push({

            role:
                item.role,

            parts: [
                {
                    text:
                        item.text
                }
            ]

        })
    }

    contents.push({

        role: 'user',

        parts: [
            {
                text: question
            }
        ]

    })

    const url =
        `https://generativelanguage.googleapis.com/v1beta/models/${db.gemini.model}:generateContent?key=${GEMINI_API_KEY}`

    const response =
        await fetch(
            url,
            {
                method: 'POST',

                headers: {
                    'Content-Type':
                        'application/json'
                },

                body:
                    JSON.stringify({

                        systemInstruction: {
                            parts: [
                                {
                                    text:
                                        db.gemini.prompt
                                }
                            ]
                        },

                        contents

                    })
            }
        )

    const data =
        await response.json()

    if (!response.ok) {

        throw new Error(
            data?.error?.message ||
            'Erreur API Gemini'
        )
    }

    const answer =
        data
            ?.candidates?.[0]
            ?.content?.parts
            ?.map(
                x => x.text
            )
            ?.join('') ||

        'Gemini n’a retourné aucune réponse.'

    history.push({

        role: 'user',

        text: question

    })

    history.push({

        role: 'model',

        text: answer

    })

    db.gemini.memory[user] =
        history.slice(-15)

    await saveDatabase()

    return answer
}

/* =====================================================
   SCHEDULER
===================================================== */

async function schedulerLoop(conn) {

    setInterval(
        async () => {

            const now =
                Date.now()

            for (
                const task of db.schedules
            ) {

                if (task.done)
                    continue

                if (
                    task.timestamp &&
                    now >=
                    task.timestamp
                ) {

                    try {

                        await conn.sendMessage(
                            task.target,
                            {
                                text:
                                    format(
                                        task.text
                                    )
                            }
                        )

                        task.done = true

                        await saveDatabase()

                        console.log(
                            `⏰ Publication ${task.id} envoyée.`
                        )

                    } catch (error) {

                        console.log(
                            'Scheduler:',
                            error.message
                        )
                    }
                }
            }

        },
        30000
    )
}

/* =====================================================
   DÉMARRAGE BOT
===================================================== */

async function startBot() {

    loadDatabase()

    await initPostgres()

    await restorePostgres()

    startPostgresSync()

    const {
        state,
        saveCreds
    } =
        await useMultiFileAuthState(
            SESSION_DIR
        )

    const {
        version
    } =
        await fetchLatestBaileysVersion()

    const conn =
        makeWASocket({

            version,

            auth: state,

            printQRInTerminal: true,

            browser: [
                BOTNAME,
                'Chrome',
                '120.0.0'
            ],

            logger:
                pino({
                    level: 'fatal'
                })

        })

    global.BOT_CONN = conn

    conn.ev.on(
        'creds.update',
        saveCreds
    )

    /* =================================================
       CONNECTION
    ================================================= */

    conn.ev.on(
        'connection.update',
        async update => {

            const {
                connection,
                lastDisconnect,
                qr
            } = update

            if (qr) {

                console.log(
                    '\n========================================'
                )

                console.log(
                    '📱 SCANNE LE QR AVEC WHATSAPP'
                )

                console.log(
                    '========================================\n'
                )

                qrcode.generate(
                    qr,
                    {
                        small: true
                    }
                )
            }

            if (
                connection === 'open'
            ) {

                console.log(
                    `\n✅ ${BOTNAME} CONNECTÉ AVEC SUCCÈS`
                )

                console.log(
                    `📦 VERSION : ${VERSION}`
                )

                console.log(
                    `☁️ POSTGRES : ${postgresEnabled ? 'ON' : 'OFF'}`
                )

                console.log(
                    `🤖 GEMINI : ${GEMINI_API_KEY ? 'CONFIGURÉ' : 'NON CONFIGURÉ'}`
                )

                console.log('')
            }

            if (
                connection === 'close'
            ) {

                const statusCode =
                    lastDisconnect
                        ?.error
                        ?.output
                        ?.statusCode

                const shouldReconnect =
                    statusCode !==
                    DisconnectReason.loggedOut

                console.log(
                    '❌ Connexion fermée.'
                )

                if (
                    shouldReconnect
                ) {

                    console.log(
                        '♻️ Reconnexion dans 3 secondes...'
                    )

                    await delay(
                        3000
                    )

                    startBot()
                } else {

                    console.log(
                        '🔴 Session déconnectée. Reconnecte WhatsApp.'
                    )
                }
            }
        }
    )

    /* =================================================
       MESSAGES
    ================================================= */

    conn.ev.on(
        'messages.upsert',
        async ({
            messages
        }) => {

            try {

                const mek =
                    messages[0]

                if (
                    !mek ||
                    !mek.message
                )
                    return

                if (
                    mek.key.fromMe
                )
                    return

                const from =
                    mek.key.remoteJid

                if (!from)
                    return

                const body =
                    getMessageText(
                        mek
                    ).trim()

                const isGroup =
                    from.endsWith(
                        '@g.us'
                    )

                const sender =
                    mek.key.participant ||
                    from

                const senderNumber =
                    getNumber(
                        sender
                    )

                const reply =
                    async text => {

                        return await conn.sendMessage(
                            from,
                            {
                                text:
                                    format(text)
                            },
                            {
                                quoted:
                                    mek
                            }
                        )
                    }

                /* =====================================
                   ANTILINK
                ===================================== */

                if (
                    isGroup &&
                    db.antiLink[from]
                ) {

                    const linkRegex =
                        /chat\.whatsapp\.com\/[0-9A-Za-z]{20,24}/i

                    if (
                        linkRegex.test(
                            body
                        )
                    ) {

                        try {

                            const metadata =
                                await getGroupMetadata(
                                    conn,
                                    from
                                )

                            const botNumber =
                                getNumber(
                                    conn.user.id
                                )

                            const botJid =
                                botNumber +
                                '@s.whatsapp.net'

                            const botAdmin =
                                isAdmin(
                                    metadata,
                                    botJid
                                )

                            const senderAdmin =
                                isAdmin(
                                    metadata,
                                    sender
                                )

                            if (
                                botAdmin &&
                                !senderAdmin
                            ) {

                                await conn.sendMessage(
                                    from,
                                    {
                                        delete:
                                            mek.key
                                    }
                                )

                                await conn.groupParticipantsUpdate(
                                    from,
                                    {
                                        delete:
                                            mek.key
                                    }
                                )

                                await conn.groupParticipantsUpdate(
                                    from,
                                    [sender],
                                    'remove'
                                )

                                await conn.sendMessage(
                                    from,
                                    {
                                        text:
                                            format(
                                                `❌ LIEN WHATSAPP DÉTECTÉ\n\n@${senderNumber} a été expulsé.`
                                            ),
                                        mentions:
                                            [sender]
                                    }
                                )

                                return
                            }

                        } catch (error) {

                            console.log(
                                'Antilink:',
                                error.message
                            )
                        }
                    }
                }

                /* =====================================
                   GEMINI AUTOMATIQUE
                   PRIVÉ UNIQUEMENT
                ===================================== */

                if (
                    !isGroup &&
                    db.gemini.enabled &&
                    isOwnerOrSudo(
                        sender
                    ) &&
                    body &&
                    !body.startsWith(
                        PREFIX
                    )
                ) {

                    try {

                        await delay(
                            db.gemini.delay *
                            1000
                        )

                        const answer =
                            await askGemini(
                                senderNumber,
                                body
                            )

                        await conn.sendMessage(
                            from,
                            {
                                text:
                                    format(
                                        `🤖 ${BOTNAME}\n\n${answer}`
                                    )
                            },
                            {
                                quoted:
                                    mek
                            }
                        )

                    } catch (error) {

                        await reply(
                            `❌ Gemini : ${error.message}`
                        )
                    }

                    return
                }

                /* =====================================
                   FILTRES CANAL
                ===================================== */

                if (
                    from.endsWith(
                        '@newsletter'
                    )
                ) {

                    const filters =
                        db.channelFilters[
                            from
                        ] || []

                    for (
                        const filter
                        of filters
                    ) {

                        const match =
                            filter.triggers.some(
                                trigger =>
                                    body
                                        .toLowerCase()
                                        .includes(
                                            trigger
                                                .toLowerCase()
                                        )
                            )

                        if (match) {

                            await conn.sendMessage(
                                from,
                                {
                                    text:
                                        filter.response
                                }
                            )

                            break
                        }
                    }
                }

                /* =====================================
                   COMMANDES
                ===================================== */

                if (
                    !body.startsWith(
                        PREFIX
                    )
                )
                    return

                const commandParts =
                    body
                        .slice(
                            PREFIX.length
                        )
                        .trim()
                        .split(/\s+/)

                const command =
                    commandParts
                        .shift()
                        ?.toLowerCase()

                const args =
                    commandParts

                const q =
                    args.join(' ').trim()

                /* =====================================
                   MENU
                ===================================== */

                if (
                    command === 'menu' ||
                    command === 'aide'
                ) {

                    if (
                        fs.existsSync(
                            LOGO_PATH
                        )
                    ) {

                        await conn.sendMessage(
                            from,
                            {
                                image:
                                    fs.readFileSync(
                                        LOGO_PATH
                                    ),
                                caption:
                                    getMenu()
                            },
                            {
                                quoted:
                                    mek
                            }
                        )

                    } else {

                        await reply(
                            getMenu()
                        )
                    }

                    return
                }

                /* =====================================
                   GMENU
                ===================================== */

                if (
                    command === 'gmenu'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Cette commande est disponible uniquement dans les groupes.'
                        )

                    return reply(
                        getGroupMenu()
                    )
                }

                /* =====================================
                   PMENU
                ===================================== */

                if (
                    command === 'pmenu'
                ) {

                    if (isGroup)
                        return reply(
                            '❌ Cette commande est disponible uniquement en privé.'
                        )

                    return reply(
                        getPrivateMenu()
                    )
                }

                /* =====================================
                   HELP
                ===================================== */

                if (
                    command === 'help'
                ) {

                    const help =
                        HELP[
                            q.toLowerCase()
                        ]

                    if (!help)
                        return reply(
                            `❌ Commande inconnue.\n\nExemple : ${PREFIX}help gemini`
                        )

                    return reply(
                        help
                    )
                }

                /* =====================================
                   JID
                ===================================== */

                if (
                    command === 'jid'
                ) {

                    return reply(
                        `🆔 JID ACTUEL\n\n${from}`
                    )
                }

                /* =====================================
                   PING
                ===================================== */

                if (
                    command === 'ping'
                ) {

                    const start =
                        Date.now()

                    await delay(
                        100
                    )

                    const latency =
                        Date.now() -
                        start

                    try {

                        await conn.sendMessage(
                            from,
                            {
                                image: {
                                    url:
                                        PING_BANNIERE
                                },

                                caption:
                                    format(
                                        `╭─❒ ⏱️ PING STATUS ❒
│
│ ⚡ LATENCE
│ └──• ${latency} ms
│
│ 🤖 ${BOTNAME}
│ 🟢 ONLINE
╰──────────────❒`
                                    )
                            },
                            {
                                quoted:
                                    mek
                            }
                        )

                    } catch {

                        return reply(
                            `🏓 PONG !\n⚡ ${latency} ms\n🟢 ${BOTNAME} ONLINE`
                        )
                    }

                    return
                }

                /* =====================================
                   INFO
                ===================================== */

                if (
                    command === 'info'
                ) {

                    return reply(
                        `╭─❒ 「 BOT INFO 」 ❒
│
│ 🤖 ${BOTNAME}
│ 📦 Version : ${VERSION}
│ 👑 Owner : ${OWNER}
│ ⚡ Prefix : ${PREFIX}
│ 🤖 Gemini : ${GEMINI_API_KEY ? 'ON' : 'OFF'}
│ ☁️ PostgreSQL : ${postgresEnabled ? 'ON' : 'OFF'}
│
╰──────────────❒

${SIGNATURE}`
                    )
                }

                /* =====================================
                   SUDO
                ===================================== */

                if (
                    command === 'sudo'
                ) {

                    const sub =
                        args.shift()
                            ?.toLowerCase()

                    if (
                        sub === 'list' ||
                        sub === 'liste'
                    ) {

                        if (
                            !isOwnerOrSudo(
                                sender
                            )
                        )
                            return reply(
                                '❌ Accès refusé.'
                            )

                        if (
                            !db.sudo.length
                        )
                            return reply(
                                '🔑 Aucun utilisateur Sudo.'
                            )

                        let text =
                            '🔑 UTILISATEURS SUDO\n\n'

                        db.sudo.forEach(
                            (
                                number,
                                index
                            ) => {

                                text +=
                                    `${index + 1}. ${number}\n`
                            }
                        )

                        return reply(
                            text
                        )
                    }

                    if (
                        !isOwner(
                            sender
                        )
                    )
                        return reply(
                            '👑 Cette opération est réservée au propriétaire.'
                        )

                    if (
                        sub === 'add'
                    ) {

                        const numbers =
                            q
                                .split(',')
                                .map(
                                    x =>
                                        x.replace(
                                            /[^0-9]/g,
                                            ''
                                        )
                                )
                                .filter(Boolean)

                        if (
                            !numbers.length
                        )
                            return reply(
                                'Usage : .sudo add 237XXXXXXXXX'
                            )

                        for (
                            const number
                            of numbers
                        ) {

                            if (
                                !db.sudo.includes(
                                    number
                                )
                            ) {

                                db.sudo.push(
                                    number
                                )
                            }
                        }

                        await saveDatabase()

                        return reply(
                            `✅ ${numbers.length} utilisateur(s) ajouté(s) comme Sudo.`
                        )
                    }

                    if (
                        sub === 'rm'
                    ) {

                        if (
                        sub === 'rm'
                    ) {

                        if (
                            args[0] ===
                            'tout'
                        ) {

                            db.sudo = []

                            await saveDatabase()

                            return reply(
                                '🗑️ Tous les utilisateurs Sudo ont été supprimés.'
                            )
                        }

                        const value =
                            args[0]

                        if (!value)
                            return reply(
                                'Usage : .sudo rm <numero/index>'
                            )

                        const index =
                            Number(
                                value
                            )

                        if (
                            Number.isInteger(
                                index
                            ) &&
                            index >= 1 &&
                            index <=
                                db.sudo.length
                        ) {

                            db.sudo.splice(
                                index - 1,
                                1
                            )

                        } else {

                            const number =
                                value.replace(
                                    /[^0-9]/g,
                                    ''
                                )

                            db.sudo =
                                db.sudo.filter(
                                    x =>
                                        x !==
                                        number
                                )
                        }

                        await saveDatabase()

                         return reply(
                            '✅ Utilisateur Sudo supprimé.'
                        )
                    }

                    return reply(
                        HELP.sudo
                    )
                }

                /* =====================================
                   GEMINI
                ===================================== */

                if (
                    command === 'gemini'
                ) {

                    if (
                        !isOwnerOrSudo(
                            sender
                        )
                    )
                        return reply(
                            '🔒 Gemini est réservé au Owner/Sudo.'
                        )

                    const sub =
                        args[0]
                            ?.toLowerCase()

                    if (
                        !q
                    )
                        return reply(
                            HELP.gemini
                        )

                    if (
                        sub === 'on'
                    ) {

                        db.gemini.enabled =
                            true

                        await saveDatabase()

                        return reply(
                            '✅ Gemini activé.\n\nMode automatique : messages privés.'
                        )
                    }

                    if (
                        sub === 'off'
                    ) {

                        db.gemini.enabled =
                            false

                        await saveDatabase()

                        return reply(
                            '❌ Gemini désactivé.'
                        )
                    }

                    if (
                        sub === 'model'
                    ) {

                        const model =
                            args
                                .slice(1)
                                .join(' ')

                        if (!model)
                            return reply(
                                `🤖 Modèle actuel : ${db.gemini.model}`
                            )

                        db.gemini.model =
                            model

                        await saveDatabase()

                        return reply(
                            `✅ Modèle Gemini changé.\n\n${model}`
                        )
                    }

                    if (
                        sub === 'delay'
                    ) {

                        const seconds =
                            Number(
                                args[1]
                            )

                        if (
                            isNaN(
                                seconds
                            ) ||
                            seconds < 0
                        )
                            return reply(
                                '❌ Exemple : .gemini delay 10'
                            )

                        db.gemini.delay =
                            seconds

                        await saveDatabase()

                        return reply(
                            `✅ Délai Gemini : ${seconds} secondes.`
                        )
                    }

                    if (
                        sub === 'prompt'
                    ) {

                        const prompt =
                            args
                                .slice(1)
                                .join(' ')

                        if (!prompt)
                            return reply(
                                '❌ Écris le nouveau prompt.'
                            )

                        db.gemini.prompt =
                            prompt

                        await saveDatabase()

                        return reply(
                            '✅ Personnalité Gemini mise à jour.'
                        )
                    }

                    if (
                        sub === 'clear'
                    ) {

                        const number =
                            args[1] ||
                            senderNumber

                        delete db.gemini.memory[
                            getNumber(
                                number
                            )
                        ]

                        await saveDatabase()

                        return reply(
                            '🧹 Mémoire Gemini supprimée.'
                        )
                    }

                    try {

                        await delay(
                            db.gemini.delay *
                            1000
                        )

                        const answer =
                            await askGemini(
                                senderNumber,
                                q
                            )

                        return conn.sendMessage(
                            from,
                            {
                                text:
                                    format(
                                        `🤖 ${BOTNAME}\n\n${answer}`
                                    )
                            },
                            {
                                quoted:
                                    mek
                            }
                        )

                    } catch (
                        error
                    ) {

                        return reply(
                            `❌ Gemini : ${error.message}`
                        )
                    }
                }

                /* =====================================
                   GPERM
                ===================================== */

                if (
                    command === 'gperm'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Groupe uniquement.'
                        )

                    if (
                        !isOwnerOrSudo(
                            sender
                        )
                    )
                        return reply(
                            '🔒 Owner/Sudo uniquement.'
                        )

                    const sub =
                        args[0]
                            ?.toLowerCase()

                    if (
                        sub === 'disable' ||
                        sub === 'block'
                    ) {

                        if (
                            !db.restrictedGroups.includes(
                                from
                            )
                        ) {

                            db.restrictedGroups.push(
                                from
                            )
                        }

                        await saveDatabase()

                        return reply(
                            '🔒 GROUPE RESTREINT\n\nSeuls Owner/Sudo peuvent utiliser les commandes.'
                        )
                    }

                    if (
                        sub === 'allow' ||
                        sub === 'unblock'
                    ) {

                        db.restrictedGroups =
                            db.restrictedGroups.filter(
                                x =>
                                    x !==
                                    from
                            )

                        await saveDatabase()

                        return reply(
                            '✅ Groupe autorisé.'
                        )
                    }

                    if (
                        sub === 'show' ||
                        sub === 'list'
                    ) {

                        if (
                            !db.restrictedGroups.length
                        )
                            return reply(
                                '🔓 Aucun groupe restreint.'
                            )

                        return reply(
                            '🔒 GROUPES RESTREINTS\n\n' +
                            db.restrictedGroups
                                .map(
                                    (
                                        x,
                                        i
                                    ) =>
                                        `${i + 1}. ${x}`
                                )
                                .join('\n')
                        )
                    }

                    if (
                        sub === 'global'
                    ) {

                        const state =
                            args[1]
                                ?.toLowerCase()

                        if (
                            state ===
                            'on'
                        ) {

                            db.globalRestrict =
                                true

                        } else if (
                            state ===
                            'off'
                        ) {

                            db.globalRestrict =
                                false

                        } else {

                            return reply(
                                'Usage : .gperm global on/off'
                            )
                        }

                        await saveDatabase()

                        return reply(
                            `🌍 Restriction globale : ${db.globalRestrict ? 'ON' : 'OFF'}`
                        )
                    }

                    if (
                        sub === 'except'
                    ) {

                        const action =
                            args[1]
                                ?.toLowerCase()

                        if (
                            action ===
                            'add'
                        ) {

                            if (
                                !!db.allowGroups.includes(
                                    from
                                )
                            ) {

                                db.allowGroups.push(
                                    from
                                )
                            }

                            await saveDatabase()

                            return reply(
                                '✅ Groupe ajouté aux exceptions.'
                            )
                        }

                        if (
                            action ===
                            'remove'
                        ) {

                            db.allowGroups =
                                db.allowGroups.filter(
                                    x =>
                                        x !==
                                        from
                                )

                            saveDatabase()

                            return reply(
                                '✅ Exception supprimée.'
                            )
                        }

                        if (
                            action ===
                            'list'
                        ) {

                            return reply(
                                '📋 EXCEPTIONS\n\n' +
                                (
                                    db.allowGroups.length
                                        ? db.allowGroups.join(
                                            '\n'
                                        )
                                        : 'Aucune'
                                )
                            )
                        }
                    }

                    return reply(
                        HELP.gperm
                    )
                }

                */

                if (
                    command ===
                    'antilink'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Groupe uniquement.'
                        )

                    if (
                        !(await canUseGroupCommands(
                            conn,
                            from,
                            sender
                        ))
                    )
                        return reply(
                            '❌ Permission refusée.'
                        )

                    if (
                        args[0] ===
                        'on'
                    ) {

                        db.antiLink[
                            from
                        ] = true

                        await saveDatabase()

                        return reply(
                            '🛡️ ANTILINK ACTIVÉ.'
                        )
                    }

                    if (
                        args[0] ===
                        'off'
                    ) {

                        delete db.antiLink[
                            from
                        ]

                        await saveDatabase()

                        return reply(
                            '❌ ANTILINK DÉSACTIVÉ.'
                        )
                    }

                    return reply(
                        HELP.antilink
                    )
                }

                /* =====================================
                   WELCOME
                ===================================== */

                if (
                    command ===
                    'welcome'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Groupe uniquement.'
                        )

                    if (
                        !(await canUseGroupCommands(
                            conn,
                            from,
                            sender
                        ))
                    )
                        return reply(
                            '❌ Permission refusée.'
                        )

                    if (
                        args[0] ===
                        'on'
                    ) {

                        db.welcome[
                            from
                        ] = true

                        await saveDatabase()

                        return reply(
                            '👋 WELCOME ACTIVÉ.'
                        )
                    }

                    if (
                        args[0] ===
                        'off'
                    ) {

                        delete db.welcome[
                            from
                        ]

                        await saveDatabase()

                        return reply(
                            '❌ WELCOME DÉSACTIVÉ.'
                        )
                    }

                    return reply(
                        'Usage : .welcome on/off'
                    )
                }

                /* =====================================
                   OPEN
                ===================================== */

                if (
                    command ===
                    'open'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Groupe uniquement.'
                        )

                    if (
                        !(await canUseGroupCommands(
                            conn,
                            from,
                            sender
                        ))
                    )
                        return reply(
                            '❌ Permission refusée.'
                        )

                    await conn.groupSettingUpdate(
                        from,
                        'not_announcement'
                    )

                    return reply(
                        '✅ GROUPE OUVERT.'
                    )
                }

                /* =====================================
                   CLOSE
                ===================================== */

                if (
                    command ===
                    'close'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Groupe uniquement.'
                        )

                    if (
                        !(await canUseGroupCommands(
                            conn,
                            from,
                            sender
                        ))
                    )
                        return reply(
                            '❌ Permission refusée.'
                        )

                    await conn.groupSettingUpdate(
                        from,
                        'announcement'
                    )

                    return reply(
                        '🔒 GROUPE FERMÉ.'
                    )
                }

                /* =====================================
                   KICK
                ===================================== */

                if (
                    command ===
                    'kick'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Groupe uniquement.'
                        )

                    if (
                        !(await canUseGroupCommands(
                            conn,
                            from,
                            sender
                        ))
                    )
                        return reply(
                            '❌ Permission refusée.'
                        )

                    const mentioned =
                        getMentioned(
                            mek
                        )

                    if (
                        !mentioned.length
                    )
                        return reply(
                            'Usage : .kick @membre'
                        )

                    await conn.groupParticipantsUpdate(
                        from,
                        mentioned,
                        'remove'
                    )

                    return reply(
                        '✅ Membre(s) expulsé(s).'
                    )
                }

                /* =====================================
                   TAGALL
                ===================================== */

                if (
                    command ===
                    'tagall'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Groupe uniquement.'
                        )

                    if (
                        !(await canUseGroupCommands(
                            conn,
                            from,
                            sender
                        ))
                    )
                        return reply(
                            '❌ Permission refusée.'
                        )

                    const metadata =
                        await getGroupMetadata(
                            conn,
                            from
                        )

                    const members =
                        metadata.participants
                            .map(
                                p =>
                                    p.id
                            )

                    let text =
                        `╭── TAG ALL ──╮\n` +
                        `┃ ➟ Groupe : ${metadata.subject}\n` +
                        `┃ ➟ Total : ${members.length}\n` +
                        `╰─────────────╯\n\n`

                    for (
                        const member
                        of members
                    ) {

                        text +=
                            `➟ @${getNumber(member)}\n`
                    }

                    return conn.sendMessage(
                        from,
                        {
                            text:
                                format(
                                    text
                                ),

                            mentions:
                                members
                        },
                        {
                            quoted:
                                mek
                        }
                    )
                }

                /* =====================================
                   ADD
                ===================================== */

                if (
                    command ===
                    'add'
                ) {

                    if (!isGroup)
                        return reply(
                            '❌ Utilise cette commande dans un groupe.'
                        )

                    if (
                        !(await canUseGroupCommands(
                            conn,
                            from,
                            sender
                        ))
                    )
                        return reply(
                            '❌ Permission refusée.'
                        )

                    const numbers =
                        args
                            .map(
                                x =>
                                    x.replace(
                                        /[^0-9]/g,
                                        ''
                                    )
                            )
                            .filter(Boolean)

                    if (
                        !numbers.length
                    )
                        return reply(
                            'Usage : .add 237XXXXXXXXX'
                        )

                    const jids =
                        numbers.map(
                            number =>
                                `${number}@s.whatsapp.net`
                        )

                    const result =
                        await conn.groupParticipantsUpdate(
                            from,
                            jids,
                            'add'
                        )

                    let response =
                        '👥 RÉSULTAT ADD\n\n'

                    result.forEach(
                        item => {

                            response +=
                                `• ${getNumber(item.jid)} : ${item.status}\n`
                        {item.status}\n`
                        }
                    )

                    return reply(
                        response
                    )
                }

                /* =====================================
                   CHFLT
                ===================================== */

                if (
                    command ===
                    'chflt'
                ) {

                    if (
                        !isOwnerOrSudo(
                            sender
                        )
                    )
                        return reply(
                            '🔒 Owner/Sudo uniquement.'
                        )

                    if (!q)
                        return reply(
                            'Usage : .chflt bonjour, salut ! Salut 👋'
                        )

                    const parts =
                        q.split('!')

                    const triggerText =
                        parts
                            .shift()
                            ?.trim()

                    const response =
                        parts
                            .join('!')
                            .trim()

                    if (
                        !triggerText ||
                        !response
                    )
                        return reply(
                            '❌ Format incorrect.'
                        )

                    const triggers =
                        triggerText
                            .split(',')
                            .map(
                                x =>
                                    x.trim()
                            )
                            .filter(Boolean)

                    const target =
                        from.endsWith(
                            '@newsletter'
                        )
                            ? from
                            : db.channelDefault[
                                senderNumber
                            ]

                    if (!target)
                        return reply(
                            '❌ Aucun canal cible.\nUtilise .chdefault <JID>.'
                        )

                    db.channelFilters[
                        target
                    ] ??= []

                    db.channelFilters[
                        target
                    ].push({

                        triggers,

                        response
                    })

                    await saveDatabase()

                    return reply(
                        `✅ Filtre ajouté.\n\n🎯 ${triggers.join(', ')}`
                    )
                }

                /* =====================================
                   DELETE FILTER
                ===================================== */

                if (
                    command ===
                        'delchflt' ||
                    command ===
                        'delchfilter'
                ) {

                    if (
                        !isOwnerOrSudo(
                            sender
                        )
                    )
                        return reply(
                            '🔒 Owner/Sudo uniquement.'
                        )

                    const target =
                        from.endsWith(
                            '@newsletter'
                        )
                            ? from
                            : db.channelDefault[
                                senderNumber
                            ]

                    if (!target)
                        return reply(
                            '❌ Aucun canal cible.'
                        )

                    const triggers =
                        q
                            .split(',')
                            .map(
                                x =>
                                    x.trim()
                                        .toLowerCase()
                            )

                    db.channelFilters[
                        target
                    ] =
                        (
                            db.channelFilters[
                                target
                            ] || []
                        ).filter(
                            filter =>
                                !filter.triggers.some(
                                    trigger =>
                                        triggers.includes(
                                            trigger.toLowerCase()
                                        )
                                )
                        )

                    await saveDatabase()

                    return reply(
                        '✅ Filtre(s) supprimé(s).'
                    )
                }

                /* =====================================
                   LIST FILTER
                ===================================== */

                if (
                    command ===
                        'chflist' ||
                    command ===
                        'listchflt'
                ) {

                    const target =
                        from.endsWith(
                            '@newsletter'
                        )
                            ? from
                            : db.channelDefault[
                                senderNumber
                            ]

                    if (!target)
                        return reply(
                            '❌ Aucun canal cible.'
                        )

                    const filters =
                        db.channelFilters[
                            target
                        ] || []

                    if (
                        !filters.length
                    )
                        return reply(
                            '📋 Aucun filtre configuré.'
                        )

                    let text =
                        '📋 FILTRES DU CANAL\n\n'

                    filters.forEach(
                        (
                            filter,
                            index
                        ) => {

                            text +=
                                `${index + 1}. ${filter.triggers.join(', ')}\n`

                            text +=
                                `   ↳ ${filter.response}\n\n`
                        }
                    )

                    return reply(
                        text
                    )
                }

                /* =====================================
                   CHANNEL DEFAULT
                ===================================== */

                if (
                    command ===
                    'chdefault'
                ) {

                    if (
                        !isOwnerOrSudo(
                            sender
                        )
                    )
                        return reply(
                            '🔒 Owner/Sudo uniquement.'
                        )

                    if (
                        args[0] ===
                        'off'
                    ) {

                        delete db.channelDefault[
                            senderNumber
                        ]

                        await saveDatabase()

                        return reply(
                            '❌ Canal par défaut supprimé.'
                        )
                    }

                    if (!q)
                        return reply(
                            'Usage : .chdefault <JID>'
                        )

                    db.channelDefault[
                        senderNumber
                    ] = q

                    await saveDatabase()

                    return reply(
                        `✅ Canal par défaut enregistré :\n${q}`
                    )
                }

                /* =====================================
                   CHANNEL SCHEDULER
                ===================================== */

                if (
                    command ===
                    'chsched'
                ) {

                    if (
                        !isOwnerOrSudo(
                            sender
                        )
                    )
                        return reply(
                            '🔒 Owner/Sudo uniquement.'
                        )

                    const sub =
                        args.shift()
                            ?.toLowerCase()

                    const target =
                        from.endsWith(
                            '@newsletter'
                        )
                            ? from
                            : db.channelDefault[
                                senderNumber
                            ]

                    /* LIST */

                    if (
                        sub ===
                            'list' ||
                        sub ===
                            'liste'
                    ) {

                        const tasks =
                            db.schedules.filter(
                                task =>
                                    task.owner ===
                                    senderNumber
                            )

                        if (
                            !tasks.length
                        )
                            return reply(
                                '⏰ Aucun calendrier.'
                            )

                        let text =
                            '⏰ PUBLICATIONS\n\n'

                        tasks.forEach(
                            task => {

                                text +=
                                    `🆔 ${task.id}\n`

                                text +=
                                    `📅 ${new Date(task.timestamp).toLocaleString('fr-FR')}\n`

                                text +=
                                    `📢 ${task.text}\n`

                                text +=
                                    `📌 ${task.done ? 'Publié' : 'En attente'}\n\n`
                            }
                        )

                        return reply(
                            text
                        )
                    }

                    /* REMOVE */

                    if (
                        sub ===
                        'rm'
                    ) {

                        const id =
                            args[0]

                        if (
                            id ===
                            'tout'
                        ) {

                            db.schedules =
                                db.schedules.filter(
                                    task =>
                                        task.owner !==
                                        senderNumber
                                )

                        } else {

                            db.schedules =
                                db.schedules.filter(
                                    task =>
                                        String(
                                            task.id
                                        ) !==
                                        String(
                                            id
                                        )
                                )
                        }

                        await saveDatabase()

                        return reply(
                            '✅ Calendrier supprimé.'
                        )
                    }

                    /* ONCE */

                    if (
                        sub ===
                        'once'
                    ) {

                        if (!target)
                            return reply(
                                '❌ Aucun canal cible.'
                            )

                        const dateTime =
                            args.shift()

                        const text =
                            args.join(
                                ' '
                            )

                        if (
                            !dateTime ||
                            !text
                        )
                            return reply(
                                'Usage : .chsched once 2026-12-25|10:00 Message'
                            )

                        const [
                            date,
                            time
                        ] =
                            dateTime.split(
                                '|'
                            )

                        const timestamp =
                            new Date(
                                `${date}T${time}:00`
                            ).getTime()

                        if (
                            isNaN(
                                timestamp
                            )
                        )
                            return reply(
                                '❌ Date/heure invalide.'
                            )

                        const id =
                            Date.now()

                        db.schedules.push({

                            id,

                            owner:
                                senderNumber,

                            target,

                            text,

                            timestamp,

                            done:
                                false
                        })

                        await saveDatabase()

                        return reply(
                            `✅ Publication programmée.\n\n🆔 ID : ${id}\n📅 ${date} ${time}`
                        )
                    }

                    /* IN */

                    if (
                        sub ===
                        'in'
                    ) {

                        if (!target)
                            return reply(
                                '❌ Aucun canal cible.'
                            )

                        const duration =
                            args.shift()

                        const text =
                            args.join(
                                ' '
                            )

                        if (
                            !duration ||
                            !text
                        )
                            return reply(
                                         'Usage : .chsched in 2h30 Message'
                            )

                        const regex =
                            /^(\d+)(h|m|j)$/i

                        const match =
                            duration.match(
                                regex
                            )

                        if (!match)
                            return reply(
                                '❌ Utilise par exemple : 30m, 2h ou 1j.'
                            )

                        const value =
                            Number(
                                match[1]
                            )

                        const unit =
                            match[2]
                                .toLowerCase()

                        let milliseconds =
                            0

                        if (
                            unit ===
                            'm'
                        ) {

                            milliseconds =
                                value *
                                60 *
                                1000
                        }

                        if (
                            unit ===
                            'h'
                        ) {

                            milliseconds =
                                value *
                                60 *
                                60 *
                                1000
                        }

                        if (
                            unit ===
                            'j'
                        ) {

                            milliseconds =
                                value *
                                24 *
                                60 *
                                60 *
                                1000
                        }

                        const id =
                            Date.now()

                        db.schedules.push({

                            id,

                            owner:
                                senderNumber,

                            target,

                            text,

                            timestamp:
                                Date.now() +
                                milliseconds,

                            done:
                                false
                        })

                        await saveDatabase()

                        return reply(
                            `✅ Publication programmée.\n\n🆔 ID : ${id}\n⏰ Dans : ${duration}`
                        )
                    }

                    return reply(
                        `⏰ PLANIFICATEUR

.chsched once 2026-12-25|10:00 Message

.chsched in 2h Message

.chsched list

.chsched rm <ID>

.chsched rm tout`
                    )
                }

            } catch (error) {

                console.log(
                    '\n❌ MESSAGE ERROR :',
                    error
                )

            }

        }
    )
}

/* =====================================================
   LANCEMENT
===================================================== */

process.on(
    'uncaughtException',
    error => {

        console.log(
            '❌ Uncaught Exception:',
            error
        )
    }
)

process.on(
    'unhandledRejection',
    error => {

        console.log(
            '❌ Unhandled Rejection:',
            error
        )
    }
)

console.log(`
╔══════════════════════════════════════════════╗
║                                              ║
║          ${BOTNAME}          ║
║                                              ║
║              VERSION ${VERSION}              ║
║                                              ║
║       © 2026 𝑱𝑶𝑬𝑳 𝑻𝑶𝑴_𝑻𝑬𝑪𝑯             ║
║                                              ║
╚══════════════════════════════════════════════╝
`)

startBot()