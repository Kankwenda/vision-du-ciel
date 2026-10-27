/**
 * Vision du Ciel — registre d'identité, interface sombre tech.
 *
 * Enregistrement (nom, pièce d'identité, téléphone, photo), identification
 * par code ou par nom, et identification par empreinte du propriétaire
 * du téléphone (limite Android : le capteur confirme seulement le
 * propriétaire, il ne distingue pas plusieurs personnes).
 */

import React, {useCallback, useEffect, useState} from 'react';
import {
  Alert,
  FlatList,
  Image,
  NativeModules,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  launchCamera,
  launchImageLibrary,
  type ImagePickerResponse,
} from 'react-native-image-picker';

const {VisionBiometrics} = NativeModules as any;

const STORAGE_KEY = '@visionduciel:persons';

const TYPES_PIECE = [
  "Carte d'identité",
  'Passeport',
  'Permis de conduire',
  "Carte d'électeur",
  'Autre',
];

type Person = {
  id: string;
  code: string;
  nom: string;
  typePiece: string;
  numeroPiece: string;
  telephone: string;
  photo: string | null;
  date: string;
  owner: boolean;
};

type Screen = 'home' | 'register' | 'detail' | 'identify';

const COLORS = {
  bg: '#04060F',
  card: '#0D1526',
  card2: '#111E36',
  border: '#1C2B4A',
  accent: '#00D4FF',
  accent2: '#4D7CFF',
  text: '#EAF2FF',
  muted: '#8A9BB8',
  danger: '#FF4D6D',
  ok: '#2EE6A8',
};

function initials(nom: string): string {
  const parts = nom.trim().split(/\s+/);
  const first = parts[0] ? parts[0][0] : '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

function App(): React.JSX.Element {
  const [screen, setScreen] = useState<Screen>('home');
  const [persons, setPersons] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);

  // Formulaire d'enregistrement
  const [nom, setNom] = useState('');
  const [typePiece, setTypePiece] = useState(TYPES_PIECE[0]);
  const [numeroPiece, setNumeroPiece] = useState('');
  const [telephone, setTelephone] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Écran d'identification
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Person | null>(null);
  const [identifyMsg, setIdentifyMsg] = useState<string | null>(null);
  const [identifyOk, setIdentifyOk] = useState(false);

  const loadPersons = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      setPersons(raw ? (JSON.parse(raw) as Person[]) : []);
    } catch {
      setPersons([]);
    }
  }, []);

  useEffect(() => {
    loadPersons();
  }, [loadPersons]);

  const persist = async (list: Person[]) => {
    setPersons(list);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const nextCode = (list: Person[]): string => {
    let max = 0;
    for (const p of list) {
      const n = parseInt(p.code.replace('P', ''), 10);
      if (!Number.isNaN(n) && n > max) {
        max = n;
      }
    }
    return 'P' + String(max + 1).padStart(4, '0');
  };

  const resetForm = () => {
    setNom('');
    setTypePiece(TYPES_PIECE[0]);
    setNumeroPiece('');
    setTelephone('');
    setPhoto(null);
    setIsOwner(false);
  };

  const savePerson = async () => {
    const cleanNom = nom.trim();
    if (!cleanNom) {
      Alert.alert('Nom manquant', 'Le nom complet est obligatoire.');
      return;
    }
    const person: Person = {
      id: String(Date.now()),
      code: nextCode(persons),
      nom: cleanNom,
      typePiece,
      numeroPiece: numeroPiece.trim(),
      telephone: telephone.trim(),
      photo,
      date: new Date().toLocaleString('fr-FR'),
      owner: isOwner,
    };
    const base = isOwner
      ? persons.map(x => ({...x, owner: false}))
      : persons;
    await persist([...base, person]);
    resetForm();
    setSelected(person);
    setScreen('detail');
  };

  const deletePerson = (p: Person) => {
    Alert.alert(
      'Supprimer ?',
      `Supprimer définitivement ${p.nom} du registre ?`,
      [
        {text: 'Annuler', style: 'cancel'},
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            await persist(persons.filter(x => x.id !== p.id));
            setSelected(null);
            setScreen('home');
          },
        },
      ],
    );
  };

  const setOwner = async (p: Person) => {
    const list = persons.map(x => ({...x, owner: x.id === p.id}));
    await persist(list);
    setSelected({...p, owner: true});
  };

  const handlePhoto = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorCode) {
      return;
    }
    const asset = response.assets && response.assets[0];
    if (asset && asset.base64) {
      setPhoto(`data:${asset.type || 'image/jpeg'};base64,${asset.base64}`);
    } else if (asset && asset.uri) {
      setPhoto(asset.uri);
    }
  };

  const takePhoto = () => {
    launchCamera(
      {mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 800, maxHeight: 800},
      handlePhoto,
    );
  };

  const pickPhoto = () => {
    launchImageLibrary(
      {mediaType: 'photo', includeBase64: true, quality: 0.7, maxWidth: 800, maxHeight: 800},
      handlePhoto,
    );
  };

  const identifyByText = () => {
    const q = query.trim().toLowerCase();
    setIdentifyMsg(null);
    if (!q) {
      setFound(null);
      return;
    }
    const p =
      persons.find(x => x.code.toLowerCase() === q) ||
      persons.find(x => x.nom.toLowerCase().includes(q));
    if (p) {
      setFound(p);
    } else {
      setFound(null);
      setIdentifyMsg('Aucune personne trouvée pour cette recherche.');
      setIdentifyOk(false);
    }
  };

  const identifyByFingerprint = async () => {
    setIdentifyMsg(null);
    setFound(null);
    try {
      const available = await VisionBiometrics.isAvailable();
      if (!available) {
        setIdentifyMsg('Aucune empreinte enregistrée sur ce téléphone.');
        setIdentifyOk(false);
        return;
      }
      await VisionBiometrics.authenticate();
      const owner = persons.find(x => x.owner);
      if (!owner) {
        setIdentifyMsg(
          'Empreinte reconnue, mais aucun profil propriétaire n’est désigné. ' +
            'Ouvrez la fiche d’une personne et touchez « Définir comme propriétaire du téléphone ».',
        );
        setIdentifyOk(false);
        return;
      }
      setFound(owner);
      setIdentifyMsg('Empreinte reconnue : propriétaire du téléphone confirmé.');
      setIdentifyOk(true);
    } catch (e: any) {
      const code = e && e.code ? String(e.code) : '';
      if (code === 'CANCELLED') {
        return;
      }
      if (code === 'NOT_RECOGNIZED') {
        setIdentifyMsg(
          'Empreinte non reconnue : ce doigt n’est pas celui du propriétaire du téléphone.',
        );
      } else if (code === 'UNAVAILABLE') {
        setIdentifyMsg('Empreinte indisponible sur ce téléphone.');
      } else {
        setIdentifyMsg('Identification par empreinte impossible pour le moment.');
      }
      setIdentifyOk(false);
    }
  };

  const filtered = search.trim()
    ? persons.filter(
        p =>
          p.nom.toLowerCase().includes(search.trim().toLowerCase()) ||
          p.code.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : persons;

  const owner = persons.find(x => x.owner);

  const renderHeader = () => (
    <View style={styles.header}>
      <Image source={require('./assets/icon.png')} style={styles.logo} />
      <View>
        <Text style={styles.title}>VISION DU CIEL</Text>
        <Text style={styles.subtitle}>REGISTRE D’IDENTITÉ • TECH</Text>
      </View>
    </View>
  );

  const renderPersonCard = (p: Person) => (
    <View style={styles.resultCard}>
      {p.photo ? (
        <Image source={{uri: p.photo}} style={styles.bigPhoto} />
      ) : (
        <View style={[styles.bigPhoto, styles.noPhoto]}>
          <Text style={styles.noPhotoText}>{initials(p.nom)}</Text>
        </View>
      )}
      <Text style={styles.personName}>{p.nom}</Text>
      <Text style={styles.personLine}>Code : {p.code}</Text>
      <Text style={styles.personLine}>
        Pièce : {p.typePiece}
        {p.numeroPiece ? ` — ${p.numeroPiece}` : ''}
      </Text>
      <Text style={styles.personLine}>
        Téléphone : {p.telephone ? p.telephone : '—'}
      </Text>
      <Text style={styles.personLine}>Enregistré le {p.date}</Text>
      {p.owner ? (
        <Text style={styles.ownerBadge}>◆ PROPRIÉTAIRE DU TÉLÉPHONE</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {renderHeader()}

        {screen === 'home' && (
          <>
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{persons.length}</Text>
                <Text style={styles.statLabel}>PERSONNES</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum} numberOfLines={1}>
                  {owner ? owner.code : '—'}
                </Text>
                <Text style={styles.statLabel}>PROPRIÉTAIRE</Text>
              </View>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Rechercher par nom ou code…"
              placeholderTextColor={COLORS.muted}
              value={search}
              onChangeText={setSearch}
            />

            <FlatList
              data={filtered}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.empty}>
                  Aucune personne enregistrée pour le moment.
                </Text>
              }
              renderItem={({item}) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    setSelected(item);
                    setScreen('detail');
                  }}>
                  {item.photo ? (
                    <Image source={{uri: item.photo}} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbFallback]}>
                      <Text style={styles.thumbText}>{initials(item.nom)}</Text>
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.rowName}>{item.nom}</Text>
                    <Text style={styles.rowCode}>
                      {item.code} • {item.typePiece}
                    </Text>
                  </View>
                  <Text style={styles.rowArrow}>›</Text>
                </TouchableOpacity>
              )}
            />

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={() => {
                resetForm();
                setScreen('register');
              }}>
              <Text style={styles.btnPrimaryText}>+ ENREGISTRER UNE PERSONNE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline]}
              onPress={() => {
                setQuery('');
                setFound(null);
                setIdentifyMsg(null);
                setScreen('identify');
              }}>
              <Text style={styles.btnOutlineText}>IDENTIFIER UNE PERSONNE</Text>
            </TouchableOpacity>
          </>
        )}

        {screen === 'register' && (
          <>
            <Text style={styles.sectionTitle}>NOUVELLE PERSONNE</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom complet *"
              placeholderTextColor={COLORS.muted}
              value={nom}
              onChangeText={setNom}
            />
            <Text style={styles.label}>Type de pièce d’identité</Text>
            <View style={styles.chips}>
              {TYPES_PIECE.map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.chip, typePiece === t && styles.chipActive]}
                  onPress={() => setTypePiece(t)}>
                  <Text
                    style={[
                      styles.chipText,
                      typePiece === t && styles.chipTextActive,
                    ]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.input}
              placeholder="Numéro de la pièce"
              placeholderTextColor={COLORS.muted}
              value={numeroPiece}
              onChangeText={setNumeroPiece}
            />
            <TextInput
              style={styles.input}
              placeholder="Téléphone (facultatif)"
              placeholderTextColor={COLORS.muted}
              keyboardType="phone-pad"
              value={telephone}
              onChangeText={setTelephone}
            />
            {photo ? (
              <Image source={{uri: photo}} style={styles.preview} />
            ) : (
              <View style={[styles.preview, styles.noPhoto]}>
                <Text style={styles.noPhotoText}>AUCUNE PHOTO</Text>
              </View>
            )}
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={takePhoto}>
              <Text style={styles.btnOutlineText}>PRENDRE UNE PHOTO</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOutline]} onPress={pickPhoto}>
              <Text style={styles.btnOutlineText}>CHOISIR DANS LA GALERIE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.ownerCheck}
              onPress={() => setIsOwner(!isOwner)}>
              <View style={[styles.checkBox, isOwner && styles.checkBoxOn]}>
                {isOwner && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <View style={styles.ownerCheckText}>
                <Text style={styles.ownerCheckLabel}>
                  C’est le propriétaire de ce téléphone
                </Text>
                <Text style={styles.ownerCheckNote}>
                  Son doigt pourra l’identifier via « Identifier par empreinte ».
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={savePerson}>
              <Text style={styles.btnPrimaryText}>ENREGISTRER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setScreen('home')}>
              <Text style={styles.btnGhostText}>RETOUR</Text>
            </TouchableOpacity>
          </>
        )}

        {screen === 'detail' && selected && (
          <>
            <Text style={styles.sectionTitle}>FICHE D’IDENTITÉ</Text>
            {renderPersonCard(selected)}
            {!selected.owner && (
              <TouchableOpacity
                style={[styles.btn, styles.btnPrimary]}
                onPress={() => setOwner(selected)}>
                <Text style={styles.btnPrimaryText}>
                  DÉFINIR COMME PROPRIÉTAIRE DU TÉLÉPHONE
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.btn, styles.btnDanger]}
              onPress={() => deletePerson(selected)}>
              <Text style={styles.btnDangerText}>SUPPRIMER CETTE PERSONNE</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setScreen('home')}>
              <Text style={styles.btnGhostText}>RETOUR</Text>
            </TouchableOpacity>
          </>
        )}

        {screen === 'identify' && (
          <>
            <Text style={styles.sectionTitle}>IDENTIFIER UNE PERSONNE</Text>
            <TextInput
              style={styles.input}
              placeholder="Code (ex. P0001) ou nom"
              placeholderTextColor={COLORS.muted}
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity
              style={[styles.btn, styles.btnOutline]}
              onPress={identifyByText}>
              <Text style={styles.btnOutlineText}>IDENTIFIER</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary]}
              onPress={identifyByFingerprint}>
              <Text style={styles.btnPrimaryText}>IDENTIFIER PAR EMPREINTE</Text>
            </TouchableOpacity>
            {identifyMsg ? (
              <Text style={identifyOk ? styles.msgOk : styles.msgBad}>
                {identifyMsg}
              </Text>
            ) : null}
            {found ? renderPersonCard(found) : null}
            <Text style={styles.note}>
              Note : le capteur identifie uniquement le propriétaire du
              téléphone. Pour les autres personnes, l’identification se fait
              par le code ou le nom, car Android ne permet à aucune appli de
              comparer des empreintes entre plusieurs personnes.
            </Text>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setScreen('home')}>
              <Text style={styles.btnGhostText}>RETOUR</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: COLORS.bg},
  scroll: {padding: 16, paddingBottom: 40},
  header: {flexDirection: 'row', alignItems: 'center', marginBottom: 20},
  logo: {width: 56, height: 56, borderRadius: 14, marginRight: 12},
  title: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  subtitle: {color: COLORS.accent, fontSize: 11, letterSpacing: 2, marginTop: 2},
  statsRow: {flexDirection: 'row', gap: 12, marginBottom: 16},
  stat: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  statNum: {color: COLORS.accent, fontSize: 24, fontWeight: 'bold'},
  statLabel: {color: COLORS.muted, fontSize: 11, letterSpacing: 1, marginTop: 4},
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  label: {color: COLORS.muted, fontSize: 13, marginBottom: 8},
  chips: {flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12},
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipActive: {borderColor: COLORS.accent, backgroundColor: '#0A2A3A'},
  chipText: {color: COLORS.muted, fontSize: 13},
  chipTextActive: {color: COLORS.accent},
  ownerCheck: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 2,
  },
  checkBoxOn: {backgroundColor: COLORS.accent},
  checkMark: {color: '#04060F', fontWeight: 'bold', fontSize: 16},
  ownerCheckText: {flex: 1},
  ownerCheckLabel: {color: COLORS.text, fontSize: 15, fontWeight: 'bold'},
  ownerCheckNote: {color: COLORS.muted, fontSize: 12, marginTop: 4},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  thumb: {width: 48, height: 48, borderRadius: 24, marginRight: 12},
  thumbFallback: {
    backgroundColor: COLORS.card2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbText: {color: COLORS.accent, fontWeight: 'bold', fontSize: 16},
  rowText: {flex: 1},
  rowName: {color: COLORS.text, fontSize: 16, fontWeight: 'bold'},
  rowCode: {color: COLORS.muted, fontSize: 13, marginTop: 2},
  rowArrow: {color: COLORS.accent, fontSize: 26},
  empty: {color: COLORS.muted, fontSize: 14, textAlign: 'center', marginVertical: 20},
  btn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimary: {backgroundColor: COLORS.accent},
  btnPrimaryText: {color: '#04121C', fontWeight: 'bold', letterSpacing: 1, fontSize: 14},
  btnOutline: {borderWidth: 1, borderColor: COLORS.accent},
  btnOutlineText: {color: COLORS.accent, fontWeight: 'bold', letterSpacing: 1, fontSize: 14},
  btnGhost: {borderWidth: 1, borderColor: COLORS.border},
  btnGhostText: {color: COLORS.muted, fontWeight: 'bold', letterSpacing: 1, fontSize: 14},
  btnDanger: {borderWidth: 1, borderColor: COLORS.danger},
  btnDangerText: {color: COLORS.danger, fontWeight: 'bold', letterSpacing: 1, fontSize: 14},
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 16,
  },
  preview: {width: '100%', height: 220, borderRadius: 12, marginBottom: 4},
  noPhoto: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noPhotoText: {color: COLORS.muted, fontSize: 14, letterSpacing: 1},
  resultCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  bigPhoto: {width: '100%', height: 260, borderRadius: 10, marginBottom: 14},
  personName: {color: COLORS.text, fontSize: 22, fontWeight: 'bold'},
  personLine: {color: COLORS.text, fontSize: 15, marginTop: 6},
  ownerBadge: {color: COLORS.ok, fontSize: 12, letterSpacing: 1, marginTop: 12},
  msgOk: {color: COLORS.ok, fontSize: 15, marginTop: 14},
  msgBad: {color: COLORS.danger, fontSize: 15, marginTop: 14},
  note: {color: COLORS.muted, fontSize: 13, marginTop: 20, lineHeight: 19},
});

export default App;
