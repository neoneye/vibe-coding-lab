import string

A = string.ascii_uppercase
ROTORS = {
    'I': ('EKMFLGDQVZNTOWYHXUSPAIBRCJ', 'Q'),
    'II': ('AJDKSIRUXBLHWTMCQGZNPYFVOE', 'E'),
    'III': ('BDFHJLCPRTXVZNYEIWGAKMUSQO', 'V'),
    'IV': ('ESOVPZJAYQUIRHXLNFTGKDCMWB', 'J'),
    'V': ('VZBRGITYUPSDNHLXAWMJQOFECK', 'Z'),
    'VI': ('JPGVOUMFYQBENHZRDKASXLICTW', 'ZM'),
    'VII': ('NZJHGRCXMYSWBOUFAIVLPEKQDT', 'ZM'),
    'VIII': ('FKQHTLXOCBJSPDZRAMEWNIUYGV', 'ZM'),
    'BETA': ('LEYJVCNIXWPBQMDRTAKZGFUHOS', ''),
    'GAMMA': ('FSOKANUERHMBTIYCWLQPZXVGJD', ''),
}
REFLECTORS = {
    'A': 'EJMZALYXVBWFCRQUONTSPIKHGD',
    'B': 'YRUHQSLDPXNGOKMIEBFZCWVJAT',
    'C': 'FVPJIAOYEDRZXWGCTKUQSBNMHL',
    'BTHIN': 'ENKQAUYWJICOPBLMDXZVFTHRGS',
    'CTHIN': 'RDOBJNTKVEHMLFCWZAXGYIPSUQ',
}


def clean(text):
    return ''.join(c for c in text.upper() if c in A)


class Enigma:
    def __init__(self, rotors, rings, reflector, plugs, positions):
        self.wires = []
        self.notches = []
        for name in rotors:
            forward = [A.index(c) for c in ROTORS[name][0]]
            inverse = [forward.index(i) for i in range(26)]
            self.wires.append((forward, inverse))
            self.notches.append(ROTORS[name][1])
        self.rings = [A.index(c) for c in rings]
        self.pos = [A.index(c) for c in positions]
        self.ref = [A.index(c) for c in REFLECTORS[reflector]]
        self.plug = list(range(26))
        for pair in plugs.split():
            a, b = (A.index(c) for c in pair)
            self.plug[a], self.plug[b] = b, a

    def step(self):
        middle_notch = A[self.pos[-2]] in self.notches[-2]
        right_notch = A[self.pos[-1]] in self.notches[-1]
        if middle_notch:
            self.pos[-3] = (self.pos[-3] + 1) % 26
        if middle_notch or right_notch:
            self.pos[-2] = (self.pos[-2] + 1) % 26
        self.pos[-1] = (self.pos[-1] + 1) % 26

    def enc_char(self, ch):
        self.step()
        value = self.plug[A.index(ch)]
        for i in reversed(range(len(self.wires))):
            offset = self.pos[i] - self.rings[i]
            value = (self.wires[i][0][(value + offset) % 26] - offset) % 26
        value = self.ref[value]
        for i in range(len(self.wires)):
            offset = self.pos[i] - self.rings[i]
            value = (self.wires[i][1][(value + offset) % 26] - offset) % 26
        return A[self.plug[value]]

    def process(self, text):
        return ''.join(self.enc_char(ch) for ch in clean(text))


msgs = [
    dict(name='1930 Enigma I manual', rotors=['II', 'I', 'III'], rings='XMV',
         reflector='A', plugs='AM FI NV PS TU WZ', pos='ABL',
         ct='''GCDSE AHUGW TQGRK VLFGX UCALX VYMIG MMNMF DXTGN
               VHVRM MEVOU YFZSL RHDRR XFJWC FHUHM UNZEF RDISI KBGPM YVXUZ''',
         pt='''FEIND LIQEI NFANT ERIEK OLONN EBEOB AQTET XANFA NGSUE DAUSG
               ANGBA ERWAL DEXEN DEDRE IKMOS TWAER TSNEU STADT'''),
    dict(name='1941 Hartjenstein', rotors=['III', 'IV', 'V'], rings='CWJ',
         reflector='B', plugs='BH CS DU EI FR GM JO KQ TX VZ', pos='ABC',
         ct='''GEELO REBSX EINXZ YDHXI TUFWD LTURT ZSPMM LFMYZ MAGJD
               WOPCB QYZRT JSTGV IJPHJ IXTDB KDFXO YILZE UIMML L''',
         pt='''EINS NEUN EINS FUENF X KOLONNEN UEBER X STARAJA RUSSA X
               STARAJA RUSSA X IN MARSQ GESETZT X HARTJENSTEIN X'''),
    dict(name='1942 U-264', rotors=['BETA', 'II', 'IV', 'I'], rings='AAAV',
         reflector='BTHIN', plugs='AT BL DF GJ HM NW OP QY RZ VX', pos='VJNA',
         ct='''NCZW VUSX PNYM INHZ XMQX SFWX WLKJ AHSH NMCO CCAK
               UQPM KCSM HKSE INJU SBLK IOSX CKUB HMLL XCSJ USRR
               DVKO HULX WCCB GVLI YXEO AHXR HKKF VDRE WEZL XOBA
               FGYU JQUK GRTV UKAM EURB VEKS UHHV OYHA BCJW MAKL
               FKLM YFVN RIZR VVRT KOFD ANJM OLBG FFLE OPRG TFLV
               RHOW OPBE KVWM UQFM PWPA RMFH AGKX IIBG''',
         pt='''VONV ONJL OOKS JHFF TTTE INSE INSD REIZ WOYY QNNS
               NEUN INHA LTXX BEIA NGRI FFUN TERW ASSE RGED RUEC
               KTYW ABOS XLET ZTER GEGN ERST ANDN ULAC HTDR EINU
               LUHR MARQ UANT ONJO TANE UNAC HTSE YHSD REIY ZWOZ
               WONU LGRA DYAC HTSM YSTO SSEN ACHX EKNS VIER MBFA
               ELLT YNNN NNNO OOVI ERYS ICHT EINS NULL'''),
    dict(name='1943 Scharnhorst', rotors=['III', 'VI', 'VIII'], rings='AHM',
         reflector='B', plugs='AN EZ HK IJ LR MQ OT PV SW UX', pos='UZV',
         ct='''YKAE NZAP MSCH ZBFO CUVM RMDP YCOF HADZ IZME FXTH
               FLOL PZLF GGBO TGOX GRET DWTJ IQHL MXVJ WKZU ASTR''',
         pt='''STEUE REJTA NAFJO RDJAN STAND ORTQU AAACC CVIER
               NEUNN EUNZW OFAHR TZWON ULSMX XSCHA RNHOR STHCO'''),
    dict(name='1945 Doenitz', rotors=['BETA', 'V', 'VI', 'VIII'], rings='EPEL',
         reflector='CTHIN', plugs='AE BF CM DQ HU JN LX PR SZ VW', pos='CDSZ',
         ct='''LANO TCTO UARB BFPM HPHG CZXT DYGA HGUF XGEW KBLK GJWL QXXT
               GPJJ AVTO YJFG SLPP QIHZ FXOE BWII EKFZ LCLO AQJU LJOY HSSM
               BBGW HZAN VOII PYRB RTDJ QDJJ OQKC XWDN BBTY VXLY TAPG VEAT
               XSON PNYN QFUD BBHH VWEP YEYD OHNL XKZD NWRH DUWU JUMW WVII
               WZXI VIUQ DRHY MNCY EFUA PNHO TKHK GDNP SAKN UAGH JZSM JBMH
               VTRE QEDG XHLZ WIFU SKDQ VELN MIMI THBH DBWV HDFY HJOQ IHOR
               TDJD BWXE MEAY XGYQ XOHF DMYU XXNO JAZR SGHP LWML RECW WUTL
               RTTV LBHY OORG LGOW UXNX HMHY FAAC QEKT HSJW''',
         pt='''KRKRALLEXXFOLGENDESISTSOFORTBEKANNTZUGEBENXXICHHABEFOLGENDENBEFEHLERHALTENXX
               JANSTERLEDESBISHERIGXNREICHSMARSCHALLSJGOERINGJSETZTDERFUEHRERSIEYHVRRGRZSSADMIRALY
               ALSSEINENNACHFOLGEREINXSCHRIFTLSCHEVOLLMACHTUNTERWEGSXABSOFORTSOLLENSIESAEMTLICHE
               MASSNAHMENVERFUEGENYDIESICHAUSDERGEGENWAERTIGENLAGEERGEBENXGEZXREICHSLEITEIKKTULPEKK
               JBORMANNJXXOBXDXMMMDURNHFKSTXKOMXADMXUUUBOOIEXKP'''),
]


def verify():
    for message in msgs:
        settings = (message['rotors'], message['rings'], message['reflector'],
                    message['plugs'], message['pos'])
        result = Enigma(*settings).process(message['ct'])
        assert result == clean(message['pt']), (message['name'], result, clean(message['pt']))
        assert Enigma(*settings).process(result) == clean(message['ct'])
        print('PASS', message['name'], len(result), 'letters, both directions')
    settings = (['I', 'II', 'III'], 'AAA', 'B', '', 'AAA')
    assert Enigma(*settings).process('AAAAA') == 'BDZGO'
    assert Enigma(*settings).process('HELLOWORLD') == 'ILBDAAMTAZ'
    machine = Enigma(['I', 'II', 'III'], 'AAA', 'B', '', 'ADU')
    for expected in ('ADV', 'AEW', 'BFX'):
        machine.step()
        assert ''.join(A[p] for p in machine.pos) == expected
    print('PASS canonical vectors and double stepping')


if __name__ == '__main__':
    verify()
