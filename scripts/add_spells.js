const fs=require("fs"),path=require("path");const root=path.join(__dirname,"..");
const D=new Function(fs.readFileSync(path.join(root,"js/data.js"),"utf8")+";return DND_DATA;")();
const add=[
 {id:"bless",name:"Благословение",nameEn:"Bless",level:1,school:"Очарование",classes:["cleric","paladin"],description:"Действие, 30 футов, концентрация до 1 минуты. До трёх существ: каждый раз, совершая бросок атаки или спасбросок, цель может бросить к4 и добавить результат."},
 {id:"command",name:"Приказ",nameEn:"Command",level:1,school:"Очарование",classes:["cleric","paladin"],description:"Действие, 60 футов, 1 раунд. Команда из одного слова существу; при провале спасброска Мудрости оно исполняет её в свой следующий ход (Брось, Падай, Подойди, Стой, Убегай и др.). Не действует на нежить, на непонимающих ваш язык и если команда напрямую вредит цели."},
 {id:"burning-hands",name:"Огненные ладони",nameEn:"Burning Hands",level:1,school:"Воплощение",classes:["sorcerer","wizard"],description:"Действие, конус 15 футов. Существа в конусе совершают спасбросок Ловкости: 3к6 урона огнём при провале, половина при успехе. Поджигает горючие предметы, которые никто не несёт."},
 {id:"divine-favor",name:"Божественное благоволение",nameEn:"Divine Favor",level:1,school:"Воплощение",classes:["paladin"],description:"Бонусное действие, на себя, концентрация до 1 минуты. Ваши атаки оружием при попадании наносят дополнительно 1к4 урона излучением."},
 {id:"animal-friendship",name:"Дружба с животными",nameEn:"Animal Friendship",level:1,school:"Очарование",classes:["bard","druid","ranger"],description:"Действие, 30 футов, 24 часа. Зверь с Интеллектом 3 и ниже, который видит и слышит вас, при провале спасброска Мудрости очарован. Заклинание оканчивается, если вы или спутник причините ему вред."},
 {id:"dissonant-whispers",name:"Диссонирующий шёпот",nameEn:"Dissonant Whispers",level:1,school:"Очарование",classes:["bard"],description:"Действие, 60 футов. Цель совершает спасбросок Мудрости: при провале 3к6 психического урона и реакцией отходит от вас как можно дальше; при успехе половина урона. Глухие автоматически преуспевают."},
 {id:"fog-cloud",name:"Туманное облако",nameEn:"Fog Cloud",level:1,school:"Вызов",classes:["druid","ranger","sorcerer","wizard"],description:"Действие, 120 футов, концентрация до 1 часа. Сфера густого тумана радиусом 20 футов, местность в ней сильно заслонена. Ветер от 10 миль в час рассеивает туман."}
];
add.forEach(sp=>{ if(!D.spells.find(x=>x.id===sp.id)) D.spells.push(sp); });
fs.writeFileSync(path.join(root,"js/data.js"),"const DND_DATA = "+JSON.stringify(D,null,1).replace(/\n/g,"\r\n")+";\r\n","utf8");
console.log(D.spells.length);
