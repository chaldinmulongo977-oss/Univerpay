-- UniPay 0002 : système LMD + données d'organisation confirmées
-- Les filières et facultés restent modifiables par les administrateurs (permission org.manage).

alter table promotions
  add column cycle text not null check (cycle in ('licence','master','doctorat')),
  add column level int not null check (level between 1 and 5);
-- Exemple : cycle='licence', level=1 -> L1 ; cycle='master', level=2 -> M2

insert into universities (name) select 'Université Révérend Kim'
where not exists (select 1 from universities);

-- Six facultés confirmées (Médecine et Sciences de la santé sont distinctes).
insert into faculties (university_id, code, name)
select u.id, v.code, v.name
from universities u,
     (values ('MED','Médecine'),('SANTE','Sciences de la santé'),('INFO','Informatique'),
            ('ECO','Économie'),('DROIT','Droit'),('COM','Communication')) as v(code,name)
on conflict (university_id, code) do nothing;

insert into programs (faculty_id, code, name)
select f.id, v.code, v.name
from faculties f,
     (values ('RT','Réseaux et télécommunications'),('GL','Génie logiciel')) as v(code,name)
where f.code = 'INFO'
on conflict (faculty_id, code) do nothing;
