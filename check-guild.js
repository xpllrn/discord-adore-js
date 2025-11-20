require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!uri) {
  console.log('No MongoDB URI found in environment');
  process.exit(1);
}

mongoose.connect(uri).then(async () => {
  const Guild = mongoose.model('Guild', new mongoose.Schema({}, { strict: false }));
  const guild = await Guild.findOne({ GuildID: '1439525673667657810' }).lean();
  
  if (guild) {
    console.log('Guild found!');
    console.log('Created at:', guild.createdAt);
    console.log('Updated at:', guild.updatedAt);
    console.log('');
    console.log('Has AutoRoles:', !!guild.AutoRoles, 'Count:', guild.AutoRoles?.length || 0);
    console.log('Has AutoReact:', !!guild.AutoReact, 'Count:', guild.AutoReact?.length || 0);
    console.log('Has AutoResponder:', !!guild.AutoResponder, 'Count:', guild.AutoResponder?.length || 0);
    console.log('Has VanityRoles:', !!guild.VanityRoles, 'Count:', guild.VanityRoles?.length || 0);
    console.log('Has Moderation:', !!guild.Moderation, 'Count:', guild.Moderation?.length || 0);
    console.log('Has LevelSystem:', !!guild.LevelSystem);
    console.log('Has ConfessionSystem:', !!guild.ConfessionSystem);
    console.log('');
    console.log('Prefix:', guild.Prefix);
  } else {
    console.log('Guild not found in database');
  }
  
  process.exit(0);
}).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
