import { MonksBloodsplats, i18n } from "./monks-bloodsplats.js";
import { EditTypes } from "./apps/edit-types.js"
import { EditImages } from "./apps/edit-images.js"

export const registerSettings = function () {
    // Register any custom module settings here
	let modulename = "monks-bloodsplats";

	let bloodsplatoptions = {
		'true': i18n("MonksBloodsplats.bloodsplatoptions.true"),
		'both': i18n("MonksBloodsplats.bloodsplatoptions.both")
	}

	game.settings.registerMenu(modulename, 'editImages', {
		label: i18n("MonksBloodsplats.edit-images.name"),
		hint: i18n("MonksBloodsplats.edit-images.hint"),
		icon: 'fas fa-image',
		restricted: true,
		type: EditImages
	});

	game.settings.registerMenu(modulename, 'editTypes', {
		label: i18n("MonksBloodsplats.edit-types.name"),
		hint: i18n("MonksBloodsplats.edit-types.hint"),
		icon: 'fas fa-list',
		restricted: true,
		type: EditTypes
	});

	game.settings.register(modulename, "show-bloodsplat", {
		name: i18n("MonksBloodsplats.show-bloodsplat.name"),
		hint: i18n("MonksBloodsplats.show-bloodsplat.hint"),
		scope: "world",
		config: true,
		default: "true",
		choices: bloodsplatoptions,
		type: String,
		requiresReload: true
	});
	game.settings.register(modulename, "bloodsplat-opacity", {
		name: i18n("MonksBloodsplats.bloodsplat-opacity.name"),
		hint: i18n("MonksBloodsplats.bloodsplat-opacity.hint"),
		scope: "world",
		config: true,
		default: 0.2,
		type: Number,
		range: {
			min: 0,
			max: 1,
			step: 0.1
		},
		requiresReload: true
	});
	game.settings.register(modulename, "bloodsplat-size", {
		name: i18n("MonksBloodsplats.bloodsplat-size.name"),
		hint: i18n("MonksBloodsplats.bloodsplat-size.hint"),
		scope: "world",
		config: true,
		default: 1,
		type: Number,
		range: {
			min: 0.2,
			max: 2,
			step: 0.1
		},
		requiresReload: true
	});
	game.settings.register(modulename, "disabled-bloodsplats", {
		name: i18n("MonksBloodsplats.disabled-bloodsplats.name"),
		hint: i18n("MonksBloodsplats.disabled-bloodsplats.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
		requiresReload: true
	});
	game.settings.register(modulename, "defeated-tokens-disabled", {
		scope: "client",
		config: false,
		default: false,
		type: Boolean,
	});
	game.settings.register(modulename, "remove-overlay", {
		name: i18n("MonksBloodsplats.remove-overlay.name"),
		hint: i18n("MonksBloodsplats.remove-overlay.hint"),
		scope: "world",
		config: false,
		default: true,
		type: Boolean,
		requiresReload: true
	});
	game.settings.register(modulename, "remove-effects", {
		name: i18n("MonksBloodsplats.remove-effects.name"),
		hint: i18n("MonksBloodsplats.remove-effects.hint"),
		scope: "world",
		config: true,
		default: true,
		type: Boolean,
	});
	game.settings.register(modulename, "defeated-status", {
		name: i18n("MonksBloodsplats.defeated-status.name"),
		hint: i18n("MonksBloodsplats.defeated-status.hint"),
		scope: "world",
		config: true,
		default: CONFIG.specialStatusEffects.DEFEATED,
		type: String,
	});
	game.settings.register(modulename, "bloodsplat-colour", {
		name: i18n("MonksBloodsplats.bloodsplat-colour.name"),
		scope: "world",
		config: false,
		default: '#ff0000',
		type: String,
		requiresReload: true
	});
	/*
	game.settings.register(modulename, "treasure-chest", {
		name: i18n("MonksBloodsplats.treasure-chest.name"),
		hint: i18n("MonksBloodsplats.treasure-chest.hint"),
		scope: "world",
		config: true,
		default: "icons/svg/chest.svg",
		type: String,
		//filePicker: true,
		requiresReload: true
	});
	game.settings.register(modulename, "treasure-chest-size", {
		name: i18n("MonksBloodsplats.treasure-chest-size.name"),
		hint: i18n("MonksBloodsplats.treasure-chest-size.hint"),
		scope: "world",
		config: true,
		default: 0.9,
		type: Number,
		range: {
			min: 0.2,
			max: 1,
			step: 0.1
		},
		requiresReload: true
	});
	*/

	game.settings.register(modulename, "image-lists", {
		scope: "world",
		config: false,
		default: [
			{
				"id": "none",
				"name": "None"
			},
			{
				"id": "unconscious",
				"name": "Unconscious"
			},
			{
				"id": "blood",
				"name": "Blood",
				"color": "#ff0000",
				"count": 221,
				"opacity": 1,
			},
			{
				"id": "scorch",
				"name": "Scorch Marks",
				"color": "#000000",
				"count": 16,
				"opacity": 1,
			},
			{
				"id": "blob",
				"name": "Blob",
				"color": "#00ff00",
				"count": 10,
				"opacity": 1,
			},
			{
				"id": "bones",
				"name": "Bones",
				"color": "#ffffff",
				"count": 17,
				"opacity": 1,
				"size": 0.8,
			},
			{
				"id": "corpse",
				"name": "Corpses",
				"color": "#ffffff",
				"count": 11,
				"opacity": 1,
			},
		],
		type: Array,
	});

	game.settings.register(modulename, "blood-types", {
		scope: "world",
		config: false,
		default: {
			default: {
				type: "blood",
				color: "#ff0000"
			}
		},
		type: Object,
	});

	game.settings.register(modulename, "transfer-settings", {
		scope: "world",
		config: false,
		default: false,
	});

	game.settings.register(modulename, "file-paths", {
		scope: "world",
		config: false,
		default: {},
		type: Object,
	});
};
