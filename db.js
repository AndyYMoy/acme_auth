const Sequelize = require('sequelize');
const { STRING } = Sequelize;

const bcrypt = require('bcrypt')

const jwt = require('jsonwebtoken')

const config = {
  logging: false
};

if(process.env.LOGGING){
  delete config.logging;
}
const conn = new Sequelize(process.env.DATABASE_URL || 'postgres://localhost/acme_db', config);

const User = conn.define('user', {
  username: STRING,
  password: STRING
});

const Note = conn.define('note', {
    text: STRING
})

Note.belongsTo(User)
User.hasMany(Note)

User.byToken = async(token)=> {
  try {

    const data = jwt.verify(token, process.env.JWT)
    console.log(data)
    const user = await User.findByPk(data.userId);

    if(user){
      return user;
    }
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
  catch(ex){
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async({ username, password })=> {
  const user = await User.findOne({
    where: {
      username,
      //password
    }
  });
  if(user){
    if (await verifyLogin(password,user.password)) {
        const token = jwt.sign({ userId: user.id}, process.env.JWT)
        return token;
    }
  }
  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

const syncAndSeed = async()=> {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw'},
    { username: 'moe', password: 'moe_pw'},
    { username: 'larry', password: 'larry_pw'}
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map( credential => User.create(credential))
  );
  const notes = [{text: 'Note 1 - Testing Note 1'}, {text: 'Note 2 - Testing Note 2'}, {text: 'Note 3 - Testing Note 3'}]
  const [note1, note2, note3] = await Promise.all( notes.map(note => Note.create(note)))
  await lucy.setNotes(note1)
  await moe.setNotes([note2, note3])
  return {
    users: {
      lucy,
      moe,
      larry
    },
    notes: {
        note1,
        note2,
        note3,
    }
  };
};

User.beforeCreate(async (user) => {

    const hashedPassword = await hashPassword(user.password)
    user.password = hashedPassword
})

async function hashPassword(password) {
    const SALT_COUNT = 5;
    const hashedPwd = await bcrypt.hash(password, SALT_COUNT)
    return hashedPwd
}

async function verifyLogin(password, passwordHash) {
    const isValid = await bcrypt.compare(password, passwordHash)

    return isValid
}

module.exports = {
  syncAndSeed,
  models: {
    User
  }
};