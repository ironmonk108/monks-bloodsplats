import { registerSettings } from "./settings.js";

export let debugEnabled = 0;

export let debug = (...args) => {
    if (debugEnabled > 1) console.log("DEBUG: monks-bloodsplats | ", ...args);
};
export let log = (...args) => console.log("monks-bloodsplats | ", ...args);
export let warn = (...args) => {
    if (debugEnabled > 0) console.warn("WARN: monks-bloodsplats | ", ...args);
};
export let error = (...args) => console.error("monks-bloodsplats | ", ...args);

export const setDebugLevel = (debugText) => {
    debugEnabled = { none: 0, warn: 1, debug: 2, all: 3 }[debugText] || 0;
    // 0 = none, warnings = 1, debug = 2, all = 3
    if (debugEnabled >= 3)
        CONFIG.debug.hooks = true;
};

export let i18n = key => {
    return game.i18n.localize(key);
};
export let setting = key => {
    if (MonksBloodsplats._setting.hasOwnProperty(key))
        return MonksBloodsplats._setting[key];
    else
        return game.settings.get("monks-bloodsplats", key);
};

export let patchFunc = (prop, func, type = "WRAPPER") => {
    let nonLibWrapper = () => {
        const oldFunc = eval(prop);
        eval(`${prop} = function (event) {
            return func.call(this, ${type != "OVERRIDE" ? "oldFunc.bind(this)," : ""} ...arguments);
        }`);
    }
    if (game.modules.get("lib-wrapper")?.active) {
        try {
            libWrapper.register("monks-enhanced-journal", prop, func, type);
        } catch (e) {
            nonLibWrapper();
        }
    } else {
        nonLibWrapper();
    }
}

export class MonksBloodsplats {
    static movingToken = false;
    static _setting = {};
    static save_file_paths = false;

    static init() {
        if (game.MonksBloodsplats == undefined)
            game.MonksBloodsplats = MonksBloodsplats;

        if (game.modules.get("lib-wrapper")?.active) {
            libWrapper.ignore_conflicts("monks-bloodsplats", "smarttarget", "foundry.canvas.placeables.Token.prototype._canControl");
            libWrapper.ignore_conflicts("monks-bloodsplats", "easy-target", "foundry.canvas.placeables.Token.prototype._canControl");
        }

        MonksBloodsplats.canvasLoading = true;

        registerSettings();

        if (game.system.id == "dnd5e") {
            game.settings.settings.get("monks-bloodsplats.blood-types").default = { "default": { "type": "blood", "color": "#ff0000" }, "elemental": { "type": "scorch" }, "fiend": { "type": "scorch" }, "ooze": { "type": "blob", "color": "#0cb300" }, "undead": { "color": "#4a4a4a" } };
        }

        MonksBloodsplats.image_list = setting("image-lists");
        MonksBloodsplats.blood_types = setting("blood-types");
        MonksBloodsplats.file_paths = setting("file-paths");

        if (Object.keys(MonksBloodsplats.file_paths).length == 0) {
            MonksBloodsplats.refreshFilepaths();
        }

        patchFunc("foundry.canvas.placeables.Token.prototype._drawOverlay", async function (wrapper, ...args) {
            if (MonksBloodsplats.isDefeated(this) && this.actor?.type !== 'character') {
                //this should be showing the bloodsplat, so don't show the skull overlay
                return;
            } else
                return wrapper(...args);
        }, "MIXED");
        patchFunc("foundry.canvas.placeables.Token.prototype._drawBar", async function (wrapper, ...args) {
            if (MonksBloodsplats.isDefeated(this) && this.actor?.type !== 'character') {
                //this should be showing the bloodsplat, so don't show the resource bars
                return false;
            } else
                return wrapper(...args);
        }, "MIXED");
        patchFunc("foundry.canvas.placeables.Token.prototype._getTooltipText", function (wrapper, ...args) {
            if (MonksBloodsplats.isDefeated(this) && this.actor?.type !== 'character') {
                //this should be showing the bloodsplat, so don't show the tooltip
                return "";
            } else
                return wrapper(...args);
        }, "MIXED");
        /*
        patchFunc("foundry.canvas.placeables.Token.prototype._canControl", function (wrapper, ...args) {
            let [user, event] = args;
            if (setting("defeated-tokens-disabled") && setting("disabled-bloodsplats") && this.bloodsplat && game.combat?.active && game.combat?.started) {
                return false;
            }
            return wrapper(...args);
        }, "MIXED");

        patchFunc("foundry.canvas.placeables.Token.prototype._canHover", function (wrapper, ...args) {
            let [user, event] = args;
            if (setting("defeated-tokens-disabled") && setting("disabled-bloodsplats") && this.bloodsplat && game.combat?.active && game.combat?.started) {
                return false;
            }
            return wrapper(...args);
        }, "MIXED");
        */

        patchFunc("foundry.canvas.placeables.Token.prototype._refreshMesh", function (wrapper, ...args) {
            let result = wrapper(...args);

            if (MonksBloodsplats.isDefeated(this) && this.object?.type !== 'character') {
                const iconAlpha = (game.user.isGM || (setting("show-bloodsplat") == "both" && !this.object?.document.hidden) ? setting("bloodsplat-opacity") : 0);
                this.mesh.alpha = iconAlpha;
            }

            return result;
        });
    }

    static async refreshFilepaths() {
        let filePaths = {};
        for (let list of MonksBloodsplats.image_list) {
            let folder = list.folder || `/modules/monks-bloodsplats/images/${list.id}`;
            let ext = list.ext || "webp";

            let pattern = folder + "/*." + ext;
            // get the list of images form the directory
            let source = "data";
            if (typeof ForgeVTT != "undefined" && ForgeVTT.usingTheForge) {
                source = "forgevtt";
            }

            // Support S3 matching
            if (/\.s3\./.test(pattern)) {
                source = "s3";
                const { bucket, keyPrefix } = foundry.utils.parseS3URL(pattern);
                if (bucket) {
                    browseOptions.bucket = bucket;
                    pattern = keyPrefix;
                }
            }

            const browseOptions = {
                wildcard: true,
                extensions: [`.${ext}`]
            };

            try {
                let content = await foundry.applications.apps.FilePicker.implementation.browse(source, pattern, browseOptions);
                filePaths[folder] = content.files;
            } catch { }
        }

        MonksBloodsplats.save_file_paths = true;
        MonksBloodsplats.file_paths = filePaths;
    }

    static getBloodType(token) {
        let types = [];
        if (game.system.id == "dnd5e") {
            types = [foundry.utils.getProperty(token, "actor.system.details.type.subtype"), foundry.utils.getProperty(token, "actor.system.details.type.value")].filter(t => !!t);
        } else if (game.system.id == "pf2e") {
            types = foundry.utils.getProperty(token, "actor.system.traits.value") || [];
        } else if (game.system.id == "pf1") {
            types = [foundry.utils.getProperty(token, "actor.system.traits.type")];
        } else if (game.system.id == "D35E") {
            types = [foundry.utils.getProperty(token, "actor.system.attributes.creatureType")];
        }

        types = types.filter(t => !!t);

        let bloodType = {
            type: foundry.utils.getProperty(token.document, 'flags.monks-bloodsplats.bloodsplat-type'),
            color: foundry.utils.getProperty(token.document, 'flags.monks-bloodsplats.bloodsplat-colour'),
            size: foundry.utils.getProperty(token.document, 'flags.monks-bloodsplats.bloodsplat-size')
        };
        if (bloodType.type == undefined || bloodType.color == undefined || bloodType.size == undefined) {
            for (let type of types) {
                if (MonksBloodsplats.blood_types[type]) {
                    let typeData = MonksBloodsplats.blood_types[type];
                    if (typeData.type && !bloodType.type)
                        bloodType.type = typeData.type;
                    if (typeData.color && !bloodType.color)
                        bloodType.color = typeData.color;
                    if (typeData.size && !bloodType.size)
                        bloodType.size = typeData.size;
                }
                if (bloodType.type != undefined && bloodType.color != undefined && bloodType.size != undefined)
                    break;
            }
        }
        if (bloodType.type == undefined)
            bloodType.type = MonksBloodsplats.blood_types.default.type || "blood";
        if (bloodType.size == undefined)
            bloodType.size = MonksBloodsplats.blood_types.default.size;

        return bloodType;
    }

    static async getBloodImage(token, animate) {
        let blood = MonksBloodsplats.getBloodType(token);
        let bloodType = blood.type;
        if (bloodType == 'none')
            return;

        let list = MonksBloodsplats.image_list.find((i) => i.id == bloodType && i.count !== 0) || MonksBloodsplats.image_list.find((i) => i.id == "blood");

        let index = foundry.utils.getProperty(token.document, 'flags.monks-bloodsplats.bloodsplat-index');
        if (index == undefined || index >= list.count) {
            index = Math.floor(Math.random() * list.count);
            if (game.user.isGM)
                await token.document.setFlag('monks-bloodsplats', 'bloodsplat-index', index);
        }

        let folder = list.folder || `/modules/monks-bloodsplats/images/${list.id}`;
        let filename = MonksBloodsplats.getImagePath(folder, index);
        if (!filename)
            return;
        const tex = PIXI.Assets.cache.has(filename) ? foundry.canvas.getTexture(filename) : await foundry.canvas.loadTexture(filename);
        if (!tex)
            return;

        let s = new PIXI.Sprite(tex);

        let colour = blood.color || list.color || MonksBloodsplats.blood_types.default.color || '#ff0000';
        let size = blood.size || list.size || setting("bloodsplat-size") || 1;
        s.tint = colour;
        s.alpha = (animate || (token.document.hidden && !game.user.isGM) ? 0 : 0.7);
        s.blendMode = PIXI.BLEND_MODES.OVERLAY;
        s.anchor.set(0.5, 0.5);
        s.width = Math.abs(token.w) * size;
        s.height = (Math.abs(token.h) * size);
        s.x = token.x + (Math.abs(token.w) / 2);
        s.y = token.y + (Math.abs(token.h) / 2);
        s.visible = token.isVisible;

        return s;
    }

    static getImagePath(folder, index) {
        let filePaths = MonksBloodsplats.file_paths || {};
        let fileList = filePaths[folder] || [];
        
        if (fileList.length == 0)
            return;
        if (index == undefined || index < 0 || index >= fileList.length) {
            index = 0;
        }
        return fileList[index];
    }

    static isDefeated(token) {
        let defeatedStatus = setting("defeated-status") || CONFIG.specialStatusEffects.DEFEATED;
        return (token && (token.combatant && token.combatant?.defeated) || !!token.actor?.statuses.has(defeatedStatus));
    }

    static async refreshBloodsplat(token) {
        if (MonksBloodsplats.isDefeated(token) && token.actor?.type !== 'character') {
            token.bars.visible = false;
            for (let effect of token.effects.children) {
                effect.alpha = 0;
            }
            if (['dnd5e.LootSheetNPC5e', 'core.MerchantSheet'].includes(token.actor?.flags?.core?.sheetClass) || token.actor?.flags["item-piles"]?.data?.enabled == true) {
                //token.mesh.alpha = 0.5;
                if (token.bloodsplat) {
                    token.bloodsplat.destroy();
                    delete token.bloodsplat;
                }
            } else if (token.document._id != undefined) {
                if (MonksBloodsplats.getBloodType(token).type == 'unconscious') {
                    token.mesh.alpha = token.mesh.alpha;
                    return;
                }

                if (setting("defeated-tokens-disabled") && setting("disabled-bloodsplats") && game.combat?.active && game.combat?.started) {
                    token.eventMode = "none";
                    token.interactive = false;
                    if (token.controlled)
                        token.release();

                    if (token.targeted.has(game.user))
                        token.setTarget(false, { releaseOthers: false });
                } else {
                    token.eventMode = "auto";
                    token.interactive = true;
                }

                if (token.bloodsplat == "loading")
                    return;

                if (token.bloodsplat?.transform == undefined) {
                    if (token._animateTo === undefined) {
                        let animate = canvas.ready && !token._original && !MonksBloodsplats.canvasLoading;
                        if (token.bloodsplat)
                            token.bloodsplat.destroy();

                        token.bloodsplat = "loading";
                        token.bloodsplat = await MonksBloodsplats.getBloodImage(token, animate);
                        if (token.bloodsplat) {
                            canvas.regions.bloodsplats?.addChild(token.bloodsplat);
                        }

                        const iconAlpha = (game.user.isGM || (setting("show-bloodsplat") == "both" && !token.document.hidden) ? setting("bloodsplat-opacity") : 0);
                        if (animate && token.bloodsplat) {
                            token._animateTo = iconAlpha;

                            const attributes = [
                                { parent: token.bloodsplat, attribute: 'alpha', to: 0.7 },
                                { parent: token.mesh, attribute: 'alpha', to: iconAlpha }
                            ];

                            foundry.canvas.animation.CanvasAnimation.animate(attributes, {
                                name: "bloodsplatAnimation" + token.id,
                                context: token,
                                duration: 800
                            }).then(() => {
                                delete token._animateTo;
                            });
                        } else {
                            token.mesh.alpha = iconAlpha;
                        }
                    }
                } else {
                    const iconAlpha = (game.user.isGM || (setting("show-bloodsplat") == "both" && !token.document.hidden) ? setting("bloodsplat-opacity") : 0);
                    if (token._animateTo != iconAlpha)
                        token.mesh.alpha = iconAlpha;
                    token.bloodsplat.position.set(token.x + (token.w / 2), token.y + (token.h / 2));
                    token.bloodsplat.visible = token.isVisible;
                }
            }
        } else {
            if (token.eventMode == "none") {
                token.eventMode = "auto";
                token.interactive = true;
            }

            if (token.bloodsplat && token._animateTo === undefined) {
                let animate = canvas.ready && !token._original && !MonksBloodsplats.canvasLoading;

                const alpha = token.alpha;
                if (animate) {
                    token._animateTo = alpha;

                    const attributes = [
                        { parent: token.bloodsplat, attribute: 'alpha', to: 0 },
                        { parent: token.mesh, attribute: 'alpha', to: alpha }
                    ];

                    foundry.canvas.animation.CanvasAnimation.animate(attributes, {
                        name: "bloodsplatAnimation" + token.id,
                        context: token,
                        duration: 800
                    }).then(() => {
                        delete token._animateTo;
                        if (token.bloodsplat) {
                            token.bloodsplat.destroy();
                            delete token.bloodsplat;
                        }
                    });
                } else {
                    token.mesh.alpha = alpha;
                    token.bloodsplat.destroy();
                    delete token.bloodsplat;
                }
            }
        }
    }

    static exportImages() {
        // load xml file using jquery ajax
        let typeId = "bones";
        $.ajax({
            type: "GET",
            url: `modules/monks-bloodsplats/images/${typeId}.xml`,
            dataType: "xml",
            success: function (xml) {
                // parse xml file and get data
                let images = xml.getElementsByTagName("glyph");

                // loop through each image and add it to the page
                $(images).each(function (index) {
                    var $this = $(this);
                    //find the d attribute of this image
                    var d = $this.attr("d");
                    // create a new svg element
                    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                    svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
                    // create a path using the d attribute and add it to the svg
                    var path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    path.setAttributeNS(null, "d", d);
                    // set the fill and stroke of the path to white
                    path.setAttributeNS(null, "fill", "white");
                    path.setAttributeNS(null, "stroke", "white");
                    var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
                    g.setAttributeNS(null, "transform", "translate(0, 0)");
                    g.appendChild(path);
                    svg.appendChild(g);
                    // add the svg element to the page
                    document.body.appendChild(svg);

                    // get the BBox of the path
                    var bbox = svg.getBBox();
                    // set the viewBox attribute of the svg
                    bbox.x -= 5;
                    bbox.y -= 5;
                    bbox.width += 10;
                    bbox.height += 10;

                    svg.setAttributeNS(null, "viewBox", bbox.x + " " + bbox.y + " " + bbox.width + " " + bbox.height);
                    // set the width and height of the svg
                    svg.setAttributeNS(null, "width", 500);
                    svg.setAttributeNS(null, "height", 500);
                    // add the height and width styles to the svg
                    svg.setAttributeNS(null, "style", "width: " + 500 + "px; height: " + 500 + "px;");
                    // convert to svg to a javascript File object
                    var svgBlob = new Blob([svg.outerHTML], { type: "image/svg+xml;charset=utf-8" });
                    // convert the blob to a File object and increment a counter to add to the filename
                    var svgFile = new File([svgBlob], `${index}.svg`, { type: "image/svg+xml;charset=utf-8" });

                    // use FilePicker to uplaod the svg to the server
                    foundry.applications.apps.FilePicker.implementation.upload("data", `modules/monks-bloodsplats/images/${typeId}`, svgFile,
                        {
                            bucket: "public",
                            path: `modules/monks-bloodsplats/images/${typeId}`,
                        },
                        { notify: false }
                    ).then((path) => {
                        console.log(path);
                    });

                    // remove the svg from the page
                    svg.remove();
                });

            }

        });
    }

    static refreshAllBloodsplats() {
        for (let token of canvas.tokens.placeables) {
            MonksBloodsplats.refreshBloodsplat(token);
        }
    }
}

Hooks.once('init', MonksBloodsplats.init);

Hooks.once('ready', () => {
    if (MonksBloodsplats.save_file_paths && game.user.isGM) {
        game.settings.set("monks-bloodsplats", "file-paths", MonksBloodsplats.file_paths);
    }
});

Hooks.on("updateSetting", (setting, data, options, userid) => {
    if (setting.key.startsWith("monks-bloodsplats")) {
        const key = setting.key.replace("monks-bloodsplats.", "");
        if (MonksBloodsplats._setting.hasOwnProperty(key))
            MonksBloodsplats._setting[key] = data.value;
    }
});

Hooks.on("createCombatant", async function (combatant, data, options) {
    //set the blood index if this is the GM
    if (setting('show-bloodsplat') != "false" && combatant && game.user.isGM) {
        let token = combatant.token; //canvas.tokens.placeables.find(t => { return (t.id == combatant._token.id); });
        if (token) {
            let blood = MonksBloodsplats.getBloodType(token);
            let bloodType = blood.type || blood;
            if (bloodType == 'none' || bloodType == 'unconscious')
                return;

            let list = MonksBloodsplats.image_list.find((i) => i.id == bloodType && i.count !== 0) || MonksBloodsplats.image_list.find((i) => i.id == "blood");

            let index = foundry.utils.getProperty(token, 'flags.monks-bloodsplats.bloodsplat-index');
            if (index == undefined || index >= list.count) {
                index = Math.floor(Math.random() * list.count);
                await token.setFlag('monks-bloodsplats', 'bloodsplat-index', index);
            }
        }
    }
});

Hooks.on("updateCombat", async function (combat, delta) {
    let combatStarted = (combat && (delta?.round === 1 && combat.turn === 0 && combat.started === true));

    //set the bloodsplat index when the combat starts to maintain consistency
    if (setting('show-bloodsplat') != "false" && game.user.isGM && combatStarted) {
        for (let combatant of combat.combatants) {
            let token = combatant.token; //canvas.tokens.placeables.find(t => { return t.id == combatant._token.id; });
            if (token) {
                let blood = MonksBloodsplats.getBloodType(token);
                let bloodType = blood.type || blood;
                if (bloodType == 'none' || bloodType == 'unconscious')
                    return;

                let list = MonksBloodsplats.image_list.find((i) => i.id == bloodType && i.count !== 0) || MonksBloodsplats.image_list.find((i) => i.id == "blood");

                let index = foundry.utils.getProperty(token.document, 'flags.monks-bloodsplats.bloodsplat-index');
                if (index == undefined || index >= list.count) {
                    index = Math.floor(Math.random() * list.count);
                    await token.document?.setFlag('monks-bloodsplats', 'bloodsplat-index', index);
                }
            }
        }
    }
});
Hooks.on("deleteCombat", async function (combat) {
    if (setting("disabled-bloodsplats") && !game.combats.active) {
        canvas.tokens.placeables.forEach(token => {
            token.eventMode = "auto";
            token.interactive = true;
        });
    }
});

Hooks.on("updateCombatant", async function (combatant, data, options) {
    let token = combatant.token;
    if (token && setting("remove-effects") && MonksBloodsplats.isDefeated(token) && game.modules.get("sequencer")?.active && token.actor?.type !== 'character') {
        Sequencer.EffectManager.endEffects({ object: token });
    }
});

Hooks.on("renderTokenConfig", (app, html, data) => {
    if (game.user.isGM) {
        let colour = foundry.utils.getProperty(app.token, "flags.monks-bloodsplats.bloodsplat-colour");
        $('<div>')
            .addClass('form-group')
            .append($('<label>').html('Bloodsplat Colour'))
            .append($('<div>').addClass('form-fields')
                .append($('<input>').addClass('color').attr('type', 'text').attr('name', 'flags.monks-bloodsplats.bloodsplat-colour').val(colour))
                .append($('<input>').attr('type', 'color').attr('data-edit', 'flags.monks-bloodsplats.bloodsplat-colour').val(colour))
            )
            .insertAfter($('[name="alpha"]', html).closest('.form-group'));

        let bloodType = MonksBloodsplats.getBloodType(app.token);
        bloodType = bloodType.id || bloodType;
        let list = MonksBloodsplats.image_list.find((i) => i.id == bloodType && i.count !== 0) || MonksBloodsplats.image_list.find((i) => i.id == "blood");
        let type = foundry.utils.getProperty(app.token, "flags.monks-bloodsplats.bloodsplat-type");
        $('<div>')
            .addClass('form-group')
            .append($('<label>').html('Bloodsplat Image'))
            .append($('<div>').addClass('form-fields')
                .append($('<select>').attr('name', 'flags.monks-bloodsplats.bloodsplat-type')
                    .append($('<option>').attr('value', '').html(`-- Default (${list.name}) --`))
                    .append(MonksBloodsplats.image_list.filter((il) => il.count !== 0 || il.id == "none").map((il) => {
                        return $('<option>').attr('value', il.id).html(il.name);
                    }))
                    .val(type)
            ))
            .insertAfter($('[name="alpha"]', html).closest('.form-group'));

        app.setPosition();
    }
});

Hooks.on("updateToken", async (document, data) => {
    let token = document.object;
    if (token && foundry.utils.getProperty(data, "flags.monks-bloodsplats") != undefined) {
        //refresh the bloodsplat if there is one
        if (token.bloodsplat) {
            token.bloodsplat.destroy();
            delete token.bloodsplat;
        }

        await MonksBloodsplats.refreshBloodsplat(token);
    }

    if (token && setting("remove-effects") && MonksBloodsplats.isDefeated(token) && game.modules.get("sequencer")?.active && token.actor?.type !== 'character') {
        Sequencer.EffectManager.endEffects({ object: token });
    }
});

Hooks.on("refreshToken", async (token) => {
    //find defeated state
    await MonksBloodsplats.refreshBloodsplat(token);
});

Hooks.on("updateToken", function (document, data, options, userid) {
    let token = document.object;
    if (!token)
        return;

    if (token.bloodsplat && data.hidden != undefined) {
        token.bloodsplat.alpha = (token.document.hidden && !game.user.isGM ? 0 : 0.7);
    }
});

Hooks.on("destroyToken", (token) => {
    if (token.bloodsplat) {
        token.bloodsplat.destroy();
        delete token.bloodsplat;
    }
});

Hooks.on("sightRefresh", function () {
    for (let token of canvas.tokens.placeables) {
        if (token.bloodsplat && token.bloodsplat !== "loading")
            token.bloodsplat.visible = token.isVisible;
    }
});

Hooks.on("drawRegionLayer", function (layer) {
    layer.bloodsplats = layer.addChildAt(new PIXI.Container(), layer.children.length - 1);
});


Hooks.on("tearDownTokenLayer", function () {
    MonksBloodsplats.canvasLoading = true;
});
Hooks.on("lightingRefresh", function () {
    MonksBloodsplats.canvasLoading = false;
});

Hooks.on("getSceneControlButtons", (controls) => {
    if (setting("disabled-bloodsplats")) {
        let tokenControls = controls["tokens"];
        tokenControls.tools["disabletoken"] = {
            name: "disabletoken",
            title: "MonksBloodsplats.DisableToken",
            icon: "fas fa-splotch",
            toggle: true,
            active: setting("defeated-tokens-disabled"),
            onChange: (event, toggled) => {
                game.settings.set("monks-bloodsplats", "defeated-tokens-disabled", toggled);
                canvas.tokens.placeables.forEach(token => {
                    if (toggled && MonksBloodsplats.isDefeated(token) && game.combats.active) {
                        token.eventMode = "none";
                        token.interactive = false;
                        if (token.controlled && game.combat?.active && game.combat?.started) {
                            token.release();
                        }
                    } else {
                        token.eventMode = "auto";
                        token.interactive = true;
                    }
                });
            }
        };
    }
});