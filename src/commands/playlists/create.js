const Command = require('../../structures/Command');

const playlists = require('../../models/playlist.js');
const { MessageEmbed } = require('discord.js');

module.exports = class Create extends Command {
	constructor(client) {
		super(client, {
			name: 'create',
			description: 'Creates or adds a song to the user\'s playlist.',
			usage: '<playlist name> <search query/link>',
			args: true,
			aliases: ['add'],
			cooldown: 5,
		});
	}
	async run(client, message, args) {
		const msg = await message.channel.send(`${client.emojiList.loading} Adding song(s) to your playlist (This might take a few seconds.)...`);

		if (!args[1]) return msg.edit('Please specify a search query or link.\nUsage: `ear create <playlist name> <search query/link>`');
		if (args[0].length > 32) return msg.edit('Playlist title must be less than 32 characters!');
		const songsToAdd = [];
		let dataLength = 0;
		let playlistMessage = '';
		let noTracks = 0;
		const playlistName = args[0].replace(/_/g, ' ');

		await search(args.slice(1).join(' '), 'no');

		async function search(sq, isPlaylist) {
			let searchQuery = sq;
			if (['youtube', 'soundcloud', 'bandcamp', 'twitch'].includes(args[1].toLowerCase())) {
				if (args[0].toLowerCase().includes('soundcloud')) return message.channel.send("Soundcloud has been temporarily disabled.")
				searchQuery = {
					source: args[1],
					query: args.slice(2).join(' '),
				};
			}

			const tries = 5;
			for (let i = 0; i < tries; i++) {
				const res = await client.music.search(searchQuery, message.author);
				if (res.loadType != 'NO_MATCHES') {
					if (res.loadType == 'TRACK_LOADED') {
						songsToAdd.push(res.tracks[0]);
						if (isPlaylist == 'no') {
							const parsedDuration = client.formatDuration(res.tracks[0].duration);
							playlistMessage = `Added **${res.tracks[0].title}** [${parsedDuration}] to **${playlistName}**.`;
							return await addSongs(false);
						}
						await addSongs(true);
						break;
					}
					else if (res.loadType == 'SEARCH_RESULT') {
						songsToAdd.push(res.tracks[0]);
						if (isPlaylist == 'no') {
							const parsedDuration = client.formatDuration(res.tracks[0].duration);
							playlistMessage = `Added **${res.tracks[0].title}** [${parsedDuration}] to **${playlistName}**.`;
							return await addSongs(false);
						}
						await addSongs(true);
						break;
					}
					else if (res.loadType == 'PLAYLIST_LOADED') {
						for (let n = 0; n < res.playlist.tracks.length; n++) {
							songsToAdd.push(res.playlist.tracks[n]);
						}
						// eslint-disable-next-line no-case-declarations
						const parsedDuration = client.formatDuration(res.playlist.tracks.reduce((acc, cure) => ({ duration: acc.duration + cure.duration })).duration);
						playlistMessage = `Added **${res.playlist.info.name}** (${parsedDuration}) (${res.playlist.tracks.length} tracks) to **${playlistName}**.`;
						await addSongs(false);
						break;
					}
					else if (res.loadType == 'LOAD_FAILED') {
						msg.edit('An error occured. Please try again.');
						noTracks++;
						break;
					}
				}
				else if (i >= 4 && isPlaylist == 'no') msg.edit('No tracks found.');
				else if (i >= 4 && isPlaylist == 'yes') noTracks++;
			}
		}

		async function addSongs(isPlaylist) {
			if (isPlaylist && songsToAdd.length != dataLength - noTracks) return;

			playlists.findOne({
				name: playlistName,
				creator: message.author.id,
			}, async (err, p) => {
				if (err) client.log(err);
				if (!p) {
					const newPlaylist = new playlists({
						name: playlistName,
						songs: [],
						timeCreated: Date.now(),
						thumbnail: 'none',
						creator: message.author.id,
					});

					if (songsToAdd.length > 1) {
						songsToAdd.length = await getSongsToAdd(newPlaylist.songs.length);
					}
					newPlaylist.songs = songsToAdd;
					newPlaylist.songs.length = clamp(newPlaylist.songs.length, 0, client.settings.playlistSongLimit);
					await newPlaylist.save().catch(e => console.log(e));

					const embed = new MessageEmbed()
						.setAuthor(newPlaylist.name, message.author.displayAvatarURL())
						.setDescription(`${client.emojiList.yes} Created a playlist with name: **${newPlaylist.name}**.\n${playlistMessage}`)
						.setFooter(`ID: ${newPlaylist._id} • ${newPlaylist.songs.length}/${client.settings.playlistSongLimit}`)
						.setColor(client.colors.main)
						.setTimestamp();
					msg.edit({ content: ' ', embeds: [embed] });
				}
				else {
					if (p.songs.length >= client.settings.playlistLimit) return msg.edit('You have reached the **maximum** amount of songs in the playlist');
					if (songsToAdd.length > 1) songsToAdd.length = await getSongsToAdd(p.songs.length);
					const currentPlaylist = p.songs;
					p.songs = currentPlaylist.concat(songsToAdd);
					p.songs.length = clamp(p.songs.length, 0, client.settings.playlistSongLimit);

					const embed = new MessageEmbed()
						.setAuthor(p.name, message.author.displayAvatarURL())
						.setDescription(`${client.emojiList.yes} Found an existing playlist with the name: **${p.name}**.\n${playlistMessage}`)
						.setFooter(`ID: ${p._id} • ${p.songs.length}/${client.settings.playlistSongLimit}`)
						.setColor(client.colors.main)
						.setTimestamp();
					msg.edit({ content: ' ', embeds: [embed] });
					await p.save().catch(e => client.log(e));
				}
			});

			async function getSongsToAdd(playlistLength) {
				let sTA = 0;
				const sL = await client.getSongLimit(message.author.id);
				if (playlistLength == 0) { sTA = Math.min(sL, songsToAdd.length); }
				else {
					const totalSongs = playlistLength + songsToAdd.length;
					if (totalSongs > sL) sTA = Math.min(sL - playlistLength, songsToAdd.length);
					else sTA = songsToAdd.length;
				}
				songsToAdd.length = sTA;
				return sTA;
			}
		}
	}
};

function clamp(num, min, max) {
	return num <= min ? min : num >= max ? max : num;
}