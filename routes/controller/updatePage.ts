import * as express from 'express';
const router = express.Router();
const config = require('../../config.json');
import { database } from '../../client/app';

router.use(require("express-session")(config.session));

router.get("/", (req, res) => {
    if (!req.session.bearer_token) {
        res.status(200).render("../public/pages/index.ejs", {
            user: null,
        });
    } else {
        res.status(200).render("../public/pages/index.ejs", {
            user: req.session.user_info,
        });
    }
});

router.get("/about", (req, res) => {
    if (!req.session.bearer_token) {
        res.status(200).render("../public/pages/about.ejs", {
            user: null,
        });
    } else {
        res.status(200).render("../public/pages/about.ejs", {
            user: req.session.user_info,
        });
    }
});

router.get("/terms", (req, res) => {
    if (!req.session.bearer_token) {
        res.status(200).render("../public/pages/privacy.ejs", {
            user: null,
        });
    } else {
        res.status(200).render("../public/pages/privacy.ejs", {
            user: req.session.user_info,
        });
    }
});

router.get('/servers', async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login')
    } else {
        const user = await req.session.user_info;
        const guildsResult = await fetch('https://discord.com/api/users/@me/guilds', {
            headers: {
                authorization: `${req.session.oauth_type} ${req.session.bearer_token}`,
            }
        });
        const guilds: any = await guildsResult.json();
        const guildsArray: any = [];
        function hasRequiredPermissions(permissions: number): boolean {
            return (permissions & (8 | 32)) !== 0;
        }

        for (let i = 0; i < guilds.length; i++) {
            const guild = guilds[i];

            if (hasRequiredPermissions(Number(guild.permissions))) {
                guildsArray.push({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.icon,
                    permissions: guild.permissions,
                })
            }
        }

        res.status(200).render("../public/pages/servers.ejs", {
            user: user,
            guilds: guildsArray
        });
    }
});

router.get("/servers/:id", async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login');
    } else {
        const user = await req.session.user_info;
        const guildsResult = await fetch(`https://discord.com/api/users/@me/guilds`, {
            headers: {
                authorization: `${req.session.oauth_type} ${req.session.bearer_token}`,
            }
        });
        const guilds: any = await guildsResult.json();
        const guildsArray: any = [];

        function hasRequiredPermissions(permissions: number): boolean {
            return (permissions & (8 | 32)) !== 0;
        }

        for (let i = 0; i < guilds.length; i++) {
            const guild = guilds[i];

            if (hasRequiredPermissions(Number(guild.permissions))) {
                guildsArray.push({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.icon,
                    permissions: guild.permissions,
                })
            }
        }

        const guild = await guildsArray.find((x: any) => x.id === req.params.id);
        const guildIcon = await guild.icon;
        const guildInfo = await database.getGuild(req.params.id);
        if (!guildInfo) {
            return res.redirect("/add");
        }

        const guildChannels = await fetch(`https://discord.com/api/guilds/${guild.id}/channels`, {
            headers: {
                authorization: `Bot ${process.env.BOT_TOKEN}`,
            }
        });

        const guildChannelsJson = await guildChannels.json();
        const guildRoles = await fetch(`https://discord.com/api/guilds/${guild.id}/roles`, {
            headers: {
                authorization: `Bot ${process.env.BOT_TOKEN}`,
            }
        });

        const guildRolesJson = await guildRoles.json();
        let icon;

        if (guildIcon) {
            icon = `https://cdn.discordapp.com/icons/${guild.id}/${guildIcon}.png`;
        } else {
            icon = `https://cdn.discordapp.com/attachments/1068525425963302936/1132369142780014652/top-10-cutest-cat-photos-of-all-time.jpg`
        }
        if (!guild) return res.redirect("/servers");

        res.status(200).render("../public/pages/server.ejs", {
            user: user,
            guilds: guildsArray,
            guild: guild,
            icon: icon,
            channels: guildChannelsJson,
            roles: guildRolesJson,
            guildInfoFromDB: guildInfo,
        });
    }
});

router.post("/inviteblocker/save/:id", async (req, res) => {
    try {
        if (!req.session.bearer_token) {
            res.redirect('/login');
        }
        const body = req.body;

        const guildInfo = await database.getGuild(req.params.id);

        guildInfo.InviteBlockerModule.isEnabled = body.inviteblocker;
        guildInfo.InviteBlockerModule.whitelistedChannels = Array.isArray(body.selectedChannels)
            ? body.selectedChannels
            : [];
        guildInfo.InviteBlockerModule.whitelistedRoles = Array.isArray(body.selectedRoles)
            ? body.selectedRoles
            : [];
        guildInfo.InviteBlockerModule.blockMessage = body.blockmessage.trim();

        await guildInfo.save();

        res.redirect(`/servers/${req.params.id}`);
    } catch (error) {
        console.error("Erro ao salvar as configurações:", error);
        res.redirect(`/servers/${req.params.id}?error=1`);
    }
});


router.get("/dashboard", async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login');
    } else {
        const userId: string = req.session.user_info.id;

        const userData: any = await database.getUser(userId);
        var aboutMe: string = await userData.aboutme;
        const timeout = 43200000;
        const daily = await userData.lastDaily;
        const userBanned: Boolean = await userData.isBanned;
        if (!aboutMe) aboutMe = "Você não possui um sobre mim definido!";

        if (aboutMe.length > 60) {
            const aboutme = aboutMe.match(/.{1,60}/g);
            aboutMe = aboutme.join("\n");
        }

        if (userBanned) {
            res.status(401).render("../public/pages/banned.ejs");
        }

        if (daily !== null && timeout - (Date.now() - daily) > 0) {
            return res.status(200).render("../public/pages/dashboard.ejs", {
                allowed: false,
                user: req.session.user_info,
                db: userData,
                aboutme: aboutMe,
            });
        } else {
            res.status(200).render("../public/pages/dashboard.ejs", {
                allowed: true,
                user: req.session.user_info,
                db: userData,
                aboutme: aboutMe,
            });
        }
    }
});

router.get('/daily', async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login');
    } else {
        const userId = req.session.user_info.id;
        const userData: any = await database.getUser(userId);

        let amount = Math.floor(Math.random() * 8000);
        amount = Math.round(amount / 10) * 10;
        if (amount < 1000) amount = 1000;
        const timeout = 43200000;
        const daily = await userData.lastDaily;

        if (daily !== null && timeout - (Date.now() - daily) > 0) {
            return res.redirect("/dashboard");
        } else {
            var img = "../assets/images/foxyoculos.png";

            userData.balance += amount;
            userData.lastDaily = Date.now();
            userData.save().catch(err => console.log(err));

            req.session.coins = amount;
            req.session.dbCoins = userData.balance;
            res.status(200).render("../public/pages/daily.ejs", {
                user: req.session.user_info,
                coins: req.session.coins.toLocaleString('pt-BR'),
                img: img,
                dbCoins: req.session.dbCoins.toLocaleString('pt-BR')
            });
        }
    }
});

router.get('/delete', async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login');
    } else {
        const userId = req.session.user_info.id;
        const userData: any = await database.getUser(userId);
        const marriedData: any = await database.getUser(userId);

        marriedData.marriedWith = null;
        marriedData.save()
        userData.remove().catch(err => console.log(err));
        req.session.destroy();
        return res.status(200).render("../public/pages/deletedUser.ejs");
    }
});

router.get('/confirm', async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login');
    } else {
        const userId = req.session.user_info.id;
        const userData = await database.getUser(userId);
        res.status(200).render("../public/pages/confirm.ejs", {
            user: req.session.user_info,
            db: userData
        });
    }
});

router.get("/aboutme", async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login');
    } else {
        const userId = req.session.user_info.id;
        const userData: any = await database.getUser(userId);

        res.status(200).render("../public/pages/aboutMe.ejs", {
            user: req.session.user_info,
            db: userData
        })
    }
});

router.post("/submit", async (req, res) => {
    if (!req.session.bearer_token) {
        res.redirect('/login');
    } else {
        const userData: any = await database.getUser(req.session.user_info.id);
        userData.aboutme = req.body.aboutme;
        userData.save().catch(err => console.log(err));
        return res.redirect('/dashboard');
    }
});

router.get('/error', (req, res) => {
    if (!req.session.bearer_token) {
        res.status(200).render("../public/pages/error.ejs", {
            user: null,
        });
    } else {
        res.status(200).render("../public/pages/error.ejs", {
            user: req.session.user_info
        });
    }
});

router.get('/404', (req, res) => {
    if (!req.session.bearer_token) {
        res.status(200).render("../public/pages/404.ejs", {
            user: null,
        });
    } else {
        res.status(200).render("../public/pages/404.ejs", {
            user: req.session.user_info
        });
    }
});

module.exports = router;