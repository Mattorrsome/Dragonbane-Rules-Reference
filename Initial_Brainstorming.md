want to create reference web application using angular and asp.net web api. 
Open to alternatives on technology suggestings. thinking either sqlite or posgresSql db.

must use latest technology and best practices. generate md file in base folder with logic for each descison. 

Web app serves as a look up reference for dragonbane rpg.

in "C:\Projects\Dragonbane\Source Material"
Dragonbane_Skills_Table.md
Dragonbane_Heroic_Abilities_Table.md
Dragonbane_Equipment_Tables.md
Dragonbane_Spell_Tables.md
Dragonbane_Treasure_Table.md

each Md represents the 5 (for now) reference sections of the site.
Skills
Heroic Abilities
Spells
Equipment
Treasure

Want to be able to search via text and also to view the tables as is.
is section has sub tables should be able to filter by those.

Should be able to show coin value as either basic in table or as silver coins.
money should be stored in db as copper value in addition to any value shown in base data and any calculation should be done from copper value.
front end calculations should be using Currency Exchange table. this table is never shown on front end.

Equipment section should have a selling and buying option. each piece of equipment could be sold for either full, 50%, 20% or 10% of base cost. a "bartering" toggle will further alter price by Success Result: lower 20% on buying, increase by 20% on selling; Dragon Result, halve a buying price or double a selling price.

Treasure Seection should calculate the effects it lists in it's "Value or effect" column. xD6 means x  times number from (1 to 6 random). when just D6 x is 1. 
something like: D6: "sling, short bow, longbow, light crossbow, heavy crossbow, hand crossbow." means 1 to 6 random then select from comma seperated list. so 1 is sling, 2 is shortbow etc.

Give suggestion on how to handle this data in db.