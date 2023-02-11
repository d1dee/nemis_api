/*
 * Copyright (c) 2023. MIT License.  Maina Derrick
 */

import {ObjectId} from 'mongoose';
//converts county names adn sub county names to their respective code as per nemis
import {BasicName, Grades, NemisLearner, NemisLearnerFromDb} from '../interfaces';

export const countyToNo = (
	county?: string,
	subCounty?: string
): {countyNo: Number; subCountyNo: Number} => {
	county = String(county).trim();
	subCounty = String(subCounty).trim();
	let countyNo: number;
	let subCountyNo: number;
	switch (true) {
		//Regex county names to avoid typos
		//01 Mombasa
		case /^momb.*/gi.test(county):
			countyNo = 101;
			switch (true) {
				case /^chang.*/gi.test(subCounty):
					subCountyNo = 1198;
					break;
				case /^jom.*/gi.test(subCounty):
					subCountyNo = 1199;
					break;
				case /^kis.*/gi.test(subCounty):
					subCountyNo = 1200;
					break;
				case /^lik.*/gi.test(subCounty):
					subCountyNo = 1201;
					break;
				case /^mv.*/gi.test(subCounty):
					subCountyNo = 1202;
					break;
				case /^momb.*/gi.test(subCounty):
					subCountyNo = 1202;
					break;
				case /^nya.*/gi.test(subCounty):
					subCountyNo = 1203;
					break;
				default:
					subCountyNo = 1202;
					break;
			}
			break;
		//02 Kwale
		case /^kwa.*/gi.test(county):
			countyNo = 102;
			switch (true) {
				case /^kin.*/gi.test(subCounty):
					subCountyNo = 1139;
					break;
				case /^lu.*/gi.test(subCounty):
					subCountyNo = 1141;
					break;
				case /^msa.*/gi.test(subCounty):
					subCountyNo = 1142;
					break;
				case /^ma.*/gi.test(subCounty):
					subCountyNo = 1328;
					break;
				case /^sa.*/gi.test(subCounty):
					subCountyNo = 1330;
					break;
				default:
					subCountyNo = 1141;
					break;
			}
			break;
		//03 Kilifi
		case /kili.*/gi.test(county):
			countyNo = 103;
			switch (true) {
				case /^bah.*/gi.test(subCounty):
					subCountyNo = 1094;
					break;
				case /^kil.*/gi.test(subCounty):
					subCountyNo = 1094;
					break;

				case /^gan.*/gi.test(subCounty):
					subCountyNo = 1095;
					break;
				case /^kal.*/gi.test(subCounty):
					subCountyNo = 1096;
					break;
				case /^mag.*/gi.test(subCounty):
					subCountyNo = 1098;
					break;
				case /^mal.*/gi.test(subCounty):
					subCountyNo = 1099;
					break;
				case /^ra.*/gi.test(subCounty):
					subCountyNo = 1100;
					break;
				default:
					subCountyNo = 1099;
					break;
			}
			break;
		//04 Tana River
		case /^tana.*/gi.test(county):
			countyNo = 104;
			switch (true) {
				case /^bu.*/gi.test(subCounty):
					subCountyNo = 1279;
					break;
				case /^ta.*rth$/gi.test(subCounty):
					subCountyNo = 1279;
					break;
				case /^ta.*ta$/gi.test(subCounty):
					subCountyNo = 1280;
					break;
				case /^ta.*r$/gi.test(subCounty):
					subCountyNo = 1281;
					break;
				default:
					subCountyNo = 1279;
			}
			break;
		//05 Lamu
		case /^lam.*/gi.test(county):
			countyNo = 105;
			switch (true) {
				case /^l.*ast$/gi.test(subCounty):
					subCountyNo = 1148;
					break;
				case /^l.*est$/gi.test(subCounty):
					subCountyNo = 1149;
					break;
				default:
					subCountyNo = 1148;
			}
			break;
		//06 Taita Taveta
		case /^tait.*/gi.test(county):
			countyNo = 106;
			switch (true) {
				case /^.*/gi.test(subCounty):
					subCountyNo = 1275;
					break;
				case /^mwa.*/gi.test(subCounty):
					subCountyNo = 1276;
					break;
				case /^tav.*/gi.test(subCounty):
					subCountyNo = 1277;
					break;
				case /^wu.*/gi.test(subCounty):
					subCountyNo = 1278;
					break;
				case /^tai.*/gi.test(subCounty):
					subCountyNo = 1278;
					break;
				default:
					subCountyNo = 1277;
			}
			break;
		//07 Garisa
		case /^gar.*/gi.test(county):
			countyNo = 107;
			switch (true) {
				case /^ba.*/gi.test(subCounty):
					subCountyNo = 1038;
					break;
				case /^da.*/gi.test(subCounty):
					subCountyNo = 1039;
					break;
				case /^fa.*/gi.test(subCounty):
					subCountyNo = 1040;
					break;
				case /^gar.*/gi.test(subCounty):
					subCountyNo = 1041;
					break;
				case /^hu.*/gi.test(subCounty):
					subCountyNo = 1042;
					break;
				case /^ij.*/gi.test(subCounty):
					subCountyNo = 1043;
					break;
				case /^la.*/gi.test(subCounty):
					subCountyNo = 1044;
					break;
				default:
					subCountyNo = 1041;
					break;
			}
			break;
		//08 Wajir
		case /^waj.*/gi.test(county):
			countyNo = 108;
			switch (true) {
				case /^bu.*/gi.test(subCounty):
					subCountyNo = 1309;
					break;
				case /^eld.*/gi.test(subCounty):
					subCountyNo = 1310;
					break;
				case /^hab.*/gi.test(subCounty):
					subCountyNo = 1311;
					break;
				case /^tar.*/gi.test(subCounty):
					subCountyNo = 1312;
					break;
				case /^wa.*ast$/gi.test(subCounty):
					subCountyNo = 1313;
					break;
				case /^wa.*rth$/gi.test(subCounty):
					subCountyNo = 1314;
					break;
				case /^w.*uth$/gi.test(subCounty):
					subCountyNo = 1315;
					break;
				case /^w.*est$/gi.test(subCounty):
					subCountyNo = 1316;
					break;
				default:
					subCountyNo = 1313;
					break;
			}
			break;
		//09 Mandera
		case /^mand.*/gi.test(county):
			countyNo = 109;
			switch (true) {
				case /^ba.*/gi.test(subCounty):
					subCountyNo = 1167;
					break;
				case /^la.*/gi.test(subCounty):
					subCountyNo = 1168;
					break;
				case /^m.*ral$/gi.test(subCounty):
					subCountyNo = 1169;
					break;
				case /^m.*ast/gi.test(subCounty):
					subCountyNo = 1170;
					break;
				case /^m.*rth/gi.test(subCounty):
					subCountyNo = 1171;
					break;
				case /^m.*est/gi.test(subCounty):
					subCountyNo = 1172;
					break;
				case /^ko.*/gi.test(subCounty):
					subCountyNo = 1322;
					break;
				case /^ar.*/gi.test(subCounty):
					subCountyNo = 1323;
					break;
				case /^ki.*/gi.test(subCounty):
					subCountyNo = 1324;
					break;
				default:
					subCountyNo = 1169;
					break;
			}
			break;
		//10 Marsabit
		case /^mars.*/gi.test(county):
			countyNo = 110;
			switch (true) {
				case /^cha.*/gi.test(subCounty):
					subCountyNo = 1173;
					break;
				case /^h.*rth$/gi.test(subCounty):
					subCountyNo = 1174;
					break;
				case /^loi.*/gi.test(subCounty):
					subCountyNo = 1175;
					break;
				case /^mar.*/gi.test(subCounty):
					subCountyNo = 1176;
					break;
				case /^lai.*/gi.test(subCounty):
					subCountyNo = 1177;
					break;
				case /^m.*th$/gi.test(subCounty):
					subCountyNo = 1177;
					break;
				case /^mo.*/gi.test(subCounty):
					subCountyNo = 1178;
					break;
				case /^so.*/gi.test(subCounty):
					subCountyNo = 1179;
					break;
				default:
					subCountyNo = 1178;
					break;
			}
			break;
		//11 Isiolo
		case /^isi.*/gi.test(county):
			countyNo = 111;
			switch (true) {
				case /^g.*/gi.test(subCounty):
					subCountyNo = 1053;
					break;
				case /^i.*/gi.test(subCounty):
					subCountyNo = 1054;
					break;
				case /^m.*/gi.test(subCounty):
					subCountyNo = 1055;
					break;
				default:
					subCountyNo = 1054;
			}
			break;
		//12 Meru
		case /^meru.*/gi.test(county):
			countyNo = 112;
			switch (true) {
				case /^b.*/gi.test(subCounty):
					subCountyNo = 1180;
					break;
				case /^ig.*ral$/gi.test(subCounty):
					subCountyNo = 1181;
					break;
				case /^ig.*rth$/gi.test(subCounty):
					subCountyNo = 1182;
					break;
				case /^ig.*uth$/gi.test(subCounty):
					subCountyNo = 1183;
					break;
				case /^im.*rth$/gi.test(subCounty):
					subCountyNo = 1184;
					break;
				case /^im.*uth$/gi.test(subCounty):
					subCountyNo = 1185;
					break;
				case /^m.*al$/gi.test(subCounty):
					subCountyNo = 1186;
					break;
				case /^ti.*al$/gi.test(subCounty):
					subCountyNo = 1187;
					break;
				case /^t.*ast$/gi.test(subCounty):
					subCountyNo = 1188;
					break;
				case /^t.*est$/gi.test(subCounty):
					subCountyNo = 1189;
					break;
				default:
					subCountyNo = 1186;
			}
			break;
		//13 Tharaka-nithi
		case /^thar.*/gi.test(county):
			countyNo = 113;
			switch (true) {
				case /^ma.*/gi.test(subCounty):
					subCountyNo = 1282;
					break;
				case /^me.*/gi.test(subCounty):
					subCountyNo = 1283;
					break;
				case /^t.*rth/gi.test(subCounty):
					subCountyNo = 1284;
					break;
				case /^t.*uth/gi.test(subCounty):
					subCountyNo = 1285;
					break;
				default:
					subCountyNo = 1283;
					break;
			}
			break;
		//14 Embu
		case /^emb.*/gi.test(county):
			countyNo = 114;
			switch (true) {
				case /^e.*ast$/gi.test(subCounty):
					subCountyNo = 1033;
					break;
				case /^e.*rth$/gi.test(subCounty):
					subCountyNo = 1034;
					break;
				case /^e.*est*/gi.test(subCounty):
					subCountyNo = 1035;
					break;
				case /^m.*rth$/gi.test(subCounty):
					subCountyNo = 1036;
					break;
				case /^m.*uth$/gi.test(subCounty):
					subCountyNo = 1037;
					break;
				default:
					subCountyNo = 1034;
			}
			break;
		//15 Kitui
		case /^kit.*/gi.test(county):
			countyNo = 115;
			switch (true) {
				case /^i.*/gi.test(subCounty):
					subCountyNo = 1123;
					break;
				case /^ka.*/gi.test(subCounty):
					subCountyNo = 1124;
					break;
				case /^ki.*i$/gi.test(subCounty):
					subCountyNo = 1125;
					break;
				case /^k.*l$/gi.test(subCounty):
					subCountyNo = 1126;
					break;
				case /^k.*t$/gi.test(subCounty):
					subCountyNo = 1127;
					break;
				case /^kv.*/gi.test(subCounty):
					subCountyNo = 1128;
					break;
				case /^l.*a$/gi.test(subCounty):
					subCountyNo = 1129;
					break;
				case /^ma.*/gi.test(subCounty):
					subCountyNo = 1130;
					break;
				case /^mum.*/gi.test(subCounty):
					subCountyNo = 1131;
					break;
				case /^muti.*/gi.test(subCounty):
					subCountyNo = 1132;
					break;
				case /^muto.*/gi.test(subCounty):
					subCountyNo = 1133;
					break;
				case /^m.*l$/gi.test(subCounty):
					subCountyNo = 1134;
					break;
				case /^m.*ast$/gi.test(subCounty):
					subCountyNo = 1135;
					break;
				case /^m.*est$/gi.test(subCounty):
					subCountyNo = 1136;
					break;
				case /^mi.*/gi.test(subCounty):
					subCountyNo = 1136;
					break;
				case /^nz.*/gi.test(subCounty):
					subCountyNo = 1137;
					break;
				case /^tse.*/gi.test(subCounty):
					subCountyNo = 1138;
					break;
				default:
					subCountyNo = 1126;
					break;
			}
			break;
		//16 Machakos
		case /^mach.*/gi.test(county):
			countyNo = 116;
			switch (true) {
				case /^a.*r$/gi.test(subCounty):
					subCountyNo = 1150;
					break;
				case /^kan.*/gi.test(subCounty):
					subCountyNo = 1151;
					break;
				case /^kat.*/gi.test(subCounty):
					subCountyNo = 1152;
					break;
				case /^mach.*/gi.test(subCounty):
					subCountyNo = 1153;
					break;
				case /^mas.*/gi.test(subCounty):
					subCountyNo = 1154;
					break;
				case /^mat.*/gi.test(subCounty):
					subCountyNo = 1155;
					break;
				case /^mw.*/gi.test(subCounty):
					subCountyNo = 1156;
					break;
				case /^y.*/gi.test(subCounty):
					subCountyNo = 1157;
					break;
				case /^kal.*/gi.test(subCounty):
					subCountyNo = 1325;
					break;
				default:
					subCountyNo = 1153;
					break;
			}
			break;
		//17 Makueni
		case /^mak.*/gi.test(county):
			countyNo = 117;
			switch (true) {
				case /^kat.*/gi.test(subCounty):
					subCountyNo = 1158;
					break;
				case /^kib.*/gi.test(subCounty):
					subCountyNo = 1159;
					break;
				case /^kil.*/gi.test(subCounty):
					subCountyNo = 1160;
					break;
				case /^m.*u$/gi.test(subCounty):
					subCountyNo = 1161;
					break;
				case /^m.*i$/gi.test(subCounty):
					subCountyNo = 1162;
					break;
				case /^m.*ast$/gi.test(subCounty):
					subCountyNo = 1163;
					break;
				case /^m.*est$/gi.test(subCounty):
					subCountyNo = 1164;
					break;
				case /^muk.*/gi.test(subCounty):
					subCountyNo = 1165;
					break;
				case /^nz.*/gi.test(subCounty):
					subCountyNo = 1166;
					break;
				default:
					subCountyNo = 1159;
					break;
			}
			break;
		//18 Nyandarua
		case /^nyan.*/gi.test(county):
			countyNo = 118;
			switch (true) {
				case /^k.*p$/gi.test(subCounty):
					subCountyNo = 1251;
					break;
				case /^k.*i$/gi.test(subCounty):
					subCountyNo = 1252;
					break;
				case /^m.*/gi.test(subCounty):
					subCountyNo = 1253;
					break;
				case /^n.*al$/gi.test(subCounty):
					subCountyNo = 1254;
					break;
				case /^n.*rth$/gi.test(subCounty):
					subCountyNo = 1255;
					break;
				case /^n.*uth$/gi.test(subCounty):
					subCountyNo = 1256;
					break;
				case /^n.*est$/gi.test(subCounty):
					subCountyNo = 1257;
					break;
				case /^g.*/gi.test(subCounty):
					subCountyNo = 1332;
					break;
				default:
					subCountyNo = 1251;
			}
			break;
		//19 Nyeri
		case /^nyer.*/gi.test(county):
			countyNo = 119;
			switch (true) {
				case /^k.*ast$/gi.test(subCounty):
					subCountyNo = 1258;
					break;
				case /^k.*est$/gi.test(subCounty):
					subCountyNo = 1259;
					break;
				case /^m.*ast$/gi.test(subCounty):
					subCountyNo = 1260;
					break;
				case /^m.*est$/gi.test(subCounty):
					subCountyNo = 1261;
					break;
				case /^muk.*/gi.test(subCounty):
					subCountyNo = 1262;
					break;
				case /^n.*l$/gi.test(subCounty):
					subCountyNo = 1263;
					break;
				case /^n.*th$/gi.test(subCounty):
					subCountyNo = 1264;
					break;
				case /^t.*/gi.test(subCounty):
					subCountyNo = 1265;
					break;
				default:
					subCountyNo = 1258;
					break;
			}
			break;
		//20 Kirinyaga
		case /^kiri.*/gi.test(county):
			countyNo = 120;
			switch (true) {
				case /^k.*l$/gi.test(subCounty):
					subCountyNo = 1101;
					break;
				case /^k.*ast$/gi.test(subCounty):
					subCountyNo = 1102;
					break;
				case /^k.*est$/gi.test(subCounty):
					subCountyNo = 1103;
					break;
				case /^m.*ast$/gi.test(subCounty):
					subCountyNo = 1104;
					break;
				case /^m.*est$/gi.test(subCounty):
					subCountyNo = 1105;
					break;
				default:
					subCountyNo = 1103;
			}
			break;
		//21 Murang'a
		case /^mura.*/gi.test(county):
			countyNo = 121;
			switch (true) {
				case /^gat.*/gi.test(subCounty):
					subCountyNo = 1204;
					break;
				case /^kah.*/gi.test(subCounty):
					subCountyNo = 1205;
					break;
				case /^kand.*/gi.test(subCounty):
					subCountyNo = 1206;
					break;
				case /^kang.*/gi.test(subCounty):
					subCountyNo = 1207;
					break;
				case /^kig.*/gi.test(subCounty):
					subCountyNo = 1208;
					break;
				case /^ma.*/gi.test(subCounty):
					subCountyNo = 1209;
					break;
				case /^m.*ast$/gi.test(subCounty):
					subCountyNo = 1210;
					break;
				case /^m.*uth$/gi.test(subCounty):
					subCountyNo = 1211;
					break;
				default:
					subCountyNo = 1204;
					break;
			}
			break;
		//22 Kiambu
		case /^kiam.*/gi.test(county):
			countyNo = 122;
			switch (true) {
				case /^g.*rth$/gi.test(subCounty):
					subCountyNo = 1081;
					break;
				case /^g.*uth$/gi.test(subCounty):
					subCountyNo = 1082;
					break;
				case /^gi.*/gi.test(subCounty):
					subCountyNo = 1083;
					break;
				case /^ju.*/gi.test(subCounty):
					subCountyNo = 1084;
					break;
				case /^kab.*/gi.test(subCounty):
					subCountyNo = 1085;
					break;
				case /^k.*a$/gi.test(subCounty):
					subCountyNo = 1086;
					break;
				case /^k.*u$/gi.test(subCounty):
					subCountyNo = 1087;
					break;
				case /^kik.*/gi.test(subCounty):
					subCountyNo = 1088;
					break;
				case /^la.*/gi.test(subCounty):
					subCountyNo = 1089;
					break;
				case /^li.*/gi.test(subCounty):
					subCountyNo = 1090;
					break;
				case /^ru.*/gi.test(subCounty):
					subCountyNo = 1091;
					break;
				case /^t.*ast$/gi.test(subCounty):
					subCountyNo = 1092;
					break;
				case /^t.*est$/gi.test(subCounty):
					subCountyNo = 1093;
					break;
				default:
					subCountyNo = 1084;
					break;
			}
			break;
		//23 Turkana
		case /^tur.*/gi.test(county):
			countyNo = 123;
			switch (true) {
				case /^k.*/gi.test(subCounty):
					subCountyNo = 1291;
					break;
				case /^l.*/gi.test(subCounty):
					subCountyNo = 1292;
					break;
				case /^t.*l$/gi.test(subCounty):
					subCountyNo = 1293;
					break;
				case /^t.*ast$/gi.test(subCounty):
					subCountyNo = 1294;
					break;
				case /^t.*rth$/gi.test(subCounty):
					subCountyNo = 1295;
					break;
				case /^t.*uth$/gi.test(subCounty):
					subCountyNo = 1296;
					break;
				case /^t.*est$/gi.test(subCounty):
					subCountyNo = 1297;
					break;
				default:
					subCountyNo = 1293;
					break;
			}
			break;
		//24 West Pokot
		case /^west.*/gi.test(county):
			countyNo = 124;
			switch (true) {
				case /^ki.*/gi.test(subCounty):
					subCountyNo = 1317;
					break;
				case /^p.*al$/gi.test(subCounty):
					subCountyNo = 1318;
					break;
				case /^p.*rth$/gi.test(subCounty):
					subCountyNo = 1319;
					break;
				case /^p.*uth$/gi.test(subCounty):
					subCountyNo = 1320;
					break;
				case /^w.*ot$/gi.test(subCounty):
					subCountyNo = 1321;
					break;
				default:
					subCountyNo = 1320;
					break;
			}
			break;
		//25 Samburu
		case /^samb.*/gi.test(county):
			countyNo = 125;
			switch (true) {
				case /^sa.*al$/gi.test(subCounty):
					subCountyNo = 1266;
					break;
				case /^sa.*ast$/gi.test(subCounty):
					subCountyNo = 1267;
					break;
				case /^sa.*rth$/gi.test(subCounty):
					subCountyNo = 1268;
					break;
				default:
					subCountyNo = 1266;
					break;
			}
			break;
		//26 Trans Nzoia
		case /^trans.*/gi.test(county):
			countyNo = 126;
			switch (true) {
				case /^e.*/gi.test(subCounty):
					subCountyNo = 1286;
					break;
				case /^ki.*/gi.test(subCounty):
					subCountyNo = 1287;
					break;
				case /^kw.*/gi.test(subCounty):
					subCountyNo = 1288;
					break;
				case /^t.*ast$/gi.test(subCounty):
					subCountyNo = 1289;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1290;
					break;
				case /^t.*est$/gi.test(subCounty):
					subCountyNo = 1290;
					break;
				default:
					subCountyNo = 1289;
			}
			break;
		//27 Uasin Gichu
		case /^uas.*/gi.test(county):
			countyNo = 127;
			switch (true) {
				case /^e.*ast$/gi.test(subCounty):
					subCountyNo = 1298;
					break;
				case /^a.*/gi.test(subCounty):
					subCountyNo = 1298;
					break;
				case /^e.*est$/gi.test(subCounty):
					subCountyNo = 1299;
					break;
				case /^k.*/gi.test(subCounty):
					subCountyNo = 1300;
					break;
				case /^mo.*/gi.test(subCounty):
					subCountyNo = 1301;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1302;
					break;
				case /^wa.*/gi.test(subCounty):
					subCountyNo = 1303;
					break;
				case /^ka.*/gi.test(subCounty):
					subCountyNo = 1303;
					break;
				default:
					subCountyNo = 1299;
					break;
			}
			break;
		//28 Elgeyo / Marakwet
		case /^elg.*|^marak.*/gi.test(county):
			countyNo = 128;
			switch (true) {
				case /^k.*rth$/gi.test(subCounty):
					subCountyNo = 1029;
					break;
				case /^k.*uth$/gi.test(subCounty):
					subCountyNo = 1030;
					break;
				case /^m.*ast$/gi.test(subCounty):
					subCountyNo = 1031;
					break;
				case /^m.*est$/gi.test(subCounty):
					subCountyNo = 1032;
					break;
				default:
					subCountyNo = 1031;
					break;
			}
			break;
		//29 Nandi
		case /^nand.*/gi.test(county):
			countyNo = 129;
			switch (true) {
				case /^c.*/gi.test(subCounty):
					subCountyNo = 1234;
					break;
				case /^n.*al$/gi.test(subCounty):
					subCountyNo = 1235;
					break;
				case /^n.*ast$/gi.test(subCounty):
					subCountyNo = 1236;
					break;
				case /^n.*rth$/gi.test(subCounty):
					subCountyNo = 1237;
					break;
				case /^n.*uth$/gi.test(subCounty):
					subCountyNo = 1238;
					break;
				case /^t.*/gi.test(subCounty):
					subCountyNo = 1239;
					break;
				default:
					subCountyNo = 1235;
					break;
			}
			break;
		//30 Baringo
		case /^bar.*/gi.test(county):
			countyNo = 130;
			switch (true) {
				case /^b.*l$/gi.test(subCounty):
					subCountyNo = 1001;
					break;
				case /^b.*h$/gi.test(subCounty):
					subCountyNo = 1002;
					break;
				case /^t.*est$/gi.test(subCounty):
					subCountyNo = 1003;
					break;
				case /^e.*t$/gi.test(subCounty):
					subCountyNo = 1003;
					break;
				case /^k.*/gi.test(subCounty):
					subCountyNo = 1004;
					break;
				case /^ma.*/gi.test(subCounty):
					subCountyNo = 1005;
					break;
				case /^mo.*/gi.test(subCounty):
					subCountyNo = 1006;
					break;
				case /^t.*ast$/gi.test(subCounty):
					subCountyNo = 1331;
					break;
				default:
					subCountyNo = 1001;
					break;
			}
			break;
		//31 Laikipia
		case /^laik.*/gi.test(county):
			countyNo = 131;
			switch (true) {
				case /^l.*l$/gi.test(subCounty):
					subCountyNo = 1143;
					break;
				case /^l.*ast$/gi.test(subCounty):
					subCountyNo = 1144;
					break;
				case /^l.*rth$/gi.test(subCounty):
					subCountyNo = 1145;
					break;
				case /^l.*est$/gi.test(subCounty):
					subCountyNo = 1146;
					break;
				case /^n.*/gi.test(subCounty):
					subCountyNo = 1147;
					break;
				default:
					subCountyNo = 1143;
					break;
			}
			break;
		//32 Nakuru
		case /^nak.*/gi.test(county):
			countyNo = 132;
			switch (true) {
				case /^g.*/gi.test(subCounty):
					subCountyNo = 1223;
					break;
				case /^k.*/gi.test(subCounty):
					subCountyNo = 1224;
					break;
				case /^molo.*/gi.test(subCounty):
					subCountyNo = 1226;
					break;
				case /^n.*a$/gi.test(subCounty):
					subCountyNo = 1227;
					break;
				case /^n.*u$/gi.test(subCounty):
					subCountyNo = 1228;
					break;
				case /^n.*rth$/gi.test(subCounty):
					subCountyNo = 1229;
					break;
				case /^n.*est$/gi.test(subCounty):
					subCountyNo = 1230;
					break;
				case /^nj.*/gi.test(subCounty):
					subCountyNo = 1231;
					break;
				case /^r.*/gi.test(subCounty):
					subCountyNo = 1232;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1233;
					break;
				default:
					subCountyNo = 1228;
					break;
			}
			break;
		//33 Narok
		case /^nar.*/gi.test(county):
			countyNo = 133;
			switch (true) {
				case /^n.*ast$/gi.test(subCounty):
					subCountyNo = 1240;
					break;
				case /^n.*rth$/gi.test(subCounty):
					subCountyNo = 1241;
					break;
				case /^n*uth$/gi.test(subCounty):
					subCountyNo = 1242;
					break;
				case /^n.*est$/gi.test(subCounty):
					subCountyNo = 1243;
					break;
				case /^t.*ast$/gi.test(subCounty):
					subCountyNo = 1244;
					break;
				case /^t.*est$/gi.test(subCounty):
					subCountyNo = 1245;
					break;
				default:
					subCountyNo = 1241;
					break;
			}
			break;
		//34 Kajiado
		case /^kaji.*/gi.test(county):
			countyNo = 134;
			switch (true) {
				case /^is/gi.test(subCounty):
					subCountyNo = 1056;
					break;
				case /^k.*al$.*/gi.test(subCounty):
					subCountyNo = 1057;
					break;
				case /^k.*rth$.*/gi.test(subCounty):
					subCountyNo = 1058;
					break;
				case /^k.*est$.*/gi.test(subCounty):
					subCountyNo = 1059;
					break;
				case /^l.*/gi.test(subCounty):
					subCountyNo = 1060;
					break;
				case /^m.*/gi.test(subCounty):
					subCountyNo = 1061;
					break;
				default:
					subCountyNo = 1057;
					break;
			}
			break;
		//35 Kericho
		case /^ker.*/gi.test(county):
			countyNo = 135;
			switch (true) {
				case /^be.*/gi.test(subCounty):
					subCountyNo = 1075;
					break;
				case /^bu.*/gi.test(subCounty):
					subCountyNo = 1076;
					break;
				case /^ke.*/gi.test(subCounty):
					subCountyNo = 1077;
					break;
				case /^ki.*/gi.test(subCounty):
					subCountyNo = 1078;
					break;
				case /^lo.*/gi.test(subCounty):
					subCountyNo = 1079;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1080;
					break;
				default:
					subCountyNo = 1077;
					break;
			}
			break;
		//36 Bomet
		case /^bome.*/gi.test(county):
			countyNo = 136;
			switch (true) {
				case /^b.*l$/gi.test(subCounty):
					subCountyNo = 1007;
					break;
				case /^b.*t$/gi.test(subCounty):
					subCountyNo = 1008;
					break;
				case /^c.*/gi.test(subCounty):
					subCountyNo = 1009;
					break;
				case /^k.*/gi.test(subCounty):
					subCountyNo = 1010;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1011;
					break;
				default:
					subCountyNo = 1007;
					break;
			}
			break;
		//37 Kakamega
		case /^kaka.*/gi.test(county):
			countyNo = 137;
			switch (true) {
				case /^b.*/gi.test(subCounty):
					subCountyNo = 1062;
					break;
				case /^k.*l$/gi.test(subCounty):
					subCountyNo = 1063;
					break;
				case /^k.*ast$/gi.test(subCounty):
					subCountyNo = 1064;
					break;
				case /^k.*rth$/gi.test(subCounty):
					subCountyNo = 1065;
					break;
				case /^k.*uth$/gi.test(subCounty):
					subCountyNo = 1066;
					break;
				case /^kh.*/gi.test(subCounty):
					subCountyNo = 1067;
					break;
				case /^li.*/gi.test(subCounty):
					subCountyNo = 1068;
					break;
				case /^lu.*/gi.test(subCounty):
					subCountyNo = 1069;
					break;
				case /^mat.*/gi.test(subCounty):
					subCountyNo = 1070;
					break;
				case /^matu.*/gi.test(subCounty):
					subCountyNo = 1071;
					break;
				case /^mu.*s$/gi.test(subCounty):
					subCountyNo = 1072;
					break;
				case /^mu.*t$/gi.test(subCounty):
					subCountyNo = 1073;
					break;
				case /^n.*/gi.test(subCounty):
					subCountyNo = 1074;
					break;
				default:
					subCountyNo = 1072;
					break;
			}
			break;
		//38 Vihiga
		case /^vih.*/gi.test(county):
			countyNo = 138;
			switch (true) {
				case /^e.*/gi.test(subCounty):
					subCountyNo = 1304;
					break;
				case /^h.*/gi.test(subCounty):
					subCountyNo = 1305;
					break;
				case /^l.*/gi.test(subCounty):
					subCountyNo = 1306;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1307;
					break;
				case /^v.*/gi.test(subCounty):
					subCountyNo = 1308;
					break;
				default:
					subCountyNo = 1308;
					break;
			}
			break;
		//39 Bungoma
		case /^bung.*/gi.test(county):
			countyNo = 139;
			switch (true) {
				case /^b.*a$/gi.test(subCounty):
					subCountyNo = 1012;
					break;
				case /^b.*al$/gi.test(subCounty):
					subCountyNo = 1013;
					break;
				case /^b.*ast$/gi.test(subCounty):
					subCountyNo = 1014;
					break;
				case /^b.*rth$/gi.test(subCounty):
					subCountyNo = 1015;
					break;
				case /^b.*uth$/gi.test(subCounty):
					subCountyNo = 1016;
					break;
				case /^b.*est$/gi.test(subCounty):
					subCountyNo = 1017;
					break;
				case /^ch.*/gi.test(subCounty):
					subCountyNo = 1018;
					break;
				case /^ki.*/gi.test(subCounty):
					subCountyNo = 1019;
					break;
				case /^m.*n$/gi.test(subCounty):
					subCountyNo = 1020;
					break;
				case /^w.*/gi.test(subCounty):
					subCountyNo = 1021;
					break;
				case /^k.*/gi.test(subCounty):
					subCountyNo = 1326;
					break;
				default:
					subCountyNo = 1013;
					break;
			}
			break;
		//40 Busia
		case /^bus.*/gi.test(county):
			countyNo = 140;
			switch (true) {
				case /^bun.*/gi.test(subCounty):
					subCountyNo = 1022;
					break;
				case /^bus.*/gi.test(subCounty):
					subCountyNo = 1023;
					break;
				case /^but.*/gi.test(subCounty):
					subCountyNo = 1024;
					break;
				case /^na.*/gi.test(subCounty):
					subCountyNo = 1025;
					break;
				case /^sa.*/gi.test(subCounty):
					subCountyNo = 1026;
					break;
				case /^t.*rth$/gi.test(subCounty):
					subCountyNo = 1027;
					break;
				case /^t.*uth$/gi.test(subCounty):
					subCountyNo = 1028;
					break;
				default:
					subCountyNo = 1023;
					break;
			}
			break;
		//41 Siaya
		case /^sia.*/gi.test(county):
			countyNo = 141;
			switch (true) {
				case /^bo.*/gi.test(subCounty):
					subCountyNo = 1269;
					break;
				case /^ge.*/gi.test(subCounty):
					subCountyNo = 1270;
					break;
				case /^ra.*/gi.test(subCounty):
					subCountyNo = 1271;
					break;
				case /^si.*/gi.test(subCounty):
					subCountyNo = 1272;
					break;
				case /^uge.*/gi.test(subCounty):
					subCountyNo = 1273;
					break;
				case /^ugu.*/gi.test(subCounty):
					subCountyNo = 1274;
					break;
				default:
					subCountyNo = 1272;
					break;
			}
			break;
		//42 Kisumu
		case /^kisu.*/gi.test(county):
			countyNo = 142;
			switch (true) {
				case /^k.*al$/gi.test(subCounty):
					subCountyNo = 1116;
					break;
				case /^k.*ast$/gi.test(subCounty):
					subCountyNo = 1117;
					break;
				case /^k.*est$/gi.test(subCounty):
					subCountyNo = 1118;
					break;
				case /^m.*/gi.test(subCounty):
					subCountyNo = 1119;
					break;
				case /^n.*h$/gi.test(subCounty):
					subCountyNo = 1120;
					break;
				case /^nyando.*/gi.test(subCounty):
					subCountyNo = 1121;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1122;
					break;
				default:
					subCountyNo = 1116;
					break;
			}
			break;
		//43 Homa Bay
		case /^hom.*/gi.test(county):
			countyNo = 143;
			switch (true) {
				case /^h.*ay$/gi.test(subCounty):
					subCountyNo = 1045;
					break;
				case /^mb.*/gi.test(subCounty):
					subCountyNo = 1046;
					break;
				case /^nd.*/gi.test(subCounty):
					subCountyNo = 1047;
					break;
				case /^la.*ast$/gi.test(subCounty):
					subCountyNo = 1048;
					break;
				case /^la.*rth$/gi.test(subCounty):
					subCountyNo = 1049;
					break;
				case /^la.*uth$/gi.test(subCounty):
					subCountyNo = 1050;
					break;
				case /^ra.*/gi.test(subCounty):
					subCountyNo = 1051;
					break;
				case /^s.*/gi.test(subCounty):
					subCountyNo = 1052;
					break;
				default:
					subCountyNo = 1045;
					break;
			}
			break;
		//44 Migori
		case /^migo.*/gi.test(county):
			countyNo = 144;
			switch (true) {
				case /^aw.*/gi.test(subCounty):
					subCountyNo = 1190;
					break;
				case /^k.*ast$/gi.test(subCounty):
					subCountyNo = 1191;
					break;
				case /^k.*est$/gi.test(subCounty):
					subCountyNo = 1192;
					break;
				case /^mig.*/gi.test(subCounty):
					subCountyNo = 1193;
					break;
				case /^ny.*/gi.test(subCounty):
					subCountyNo = 1194;
					break;
				case /^ro.*/gi.test(subCounty):
					subCountyNo = 1195;
					break;
				case /^s.*st$/gi.test(subCounty):
					subCountyNo = 1196;
					break;
				case /^ur.*/gi.test(subCounty):
					subCountyNo = 1197;
					break;
				case /^ma.*/gi.test(subCounty):
					subCountyNo = 1329;
					break;
				default:
					subCountyNo = 1195;
					break;
			}
			break;
		//45 Kisii
		case /^kisi.*/gi.test(county):
			countyNo = 145;
			switch (true) {
				case /^gu.*/gi.test(subCounty):
					subCountyNo = 1106;
					break;
				case /^g.*th$/gi.test(subCounty):
					subCountyNo = 1107;
					break;
				case /^ke.*/gi.test(subCounty):
					subCountyNo = 1108;
					break;
				case /^k.*al$/gi.test(subCounty):
					subCountyNo = 1109;
					break;
				case /^k.*th$/gi.test(subCounty):
					subCountyNo = 1110;
					break;
				case /^mar.*/gi.test(subCounty):
					subCountyNo = 1112;
					break;
				case /^mas.*/gi.test(subCounty):
					subCountyNo = 1113;
					break;
				case /^ny.*/gi.test(subCounty):
					subCountyNo = 1114;
					break;
				case /^sa.*/gi.test(subCounty):
					subCountyNo = 1115;
					break;
				case /^et.*/gi.test(subCounty):
					subCountyNo = 1327;
					break;
				default:
					subCountyNo = 1110;
					break;
			}
			break;
		//46 Nyamira
		case /^nyam.*/gi.test(county):
			countyNo = 146;
			switch (true) {
				case /^bo.*/gi.test(subCounty):
					subCountyNo = 1246;
					break;
				case /^man.*/gi.test(subCounty):
					subCountyNo = 1247;
					break;
				case /^ma.*th$/gi.test(subCounty):
					subCountyNo = 1248;
					break;

				case /^n.*rth$/gi.test(subCounty):
					subCountyNo = 1249;
					break;
				case /^n.*uth$/gi.test(subCounty):
					subCountyNo = 1250;
					break;
				default:
					subCountyNo = 1247;
					break;
			}
			break;
		//47 Nairobi
		case /^nai.*/gi.test(county):
			countyNo = 147;
			switch (true) {
				case /^dag.*/gi.test(subCounty):
					subCountyNo = 1212;
					break;
				case /^emb.*/gi.test(subCounty):
					subCountyNo = 1213;
					break;
				case /^kam.*/gi.test(subCounty):
					subCountyNo = 1214;
					break;
				case /^kasa.*/gi.test(subCounty):
					subCountyNo = 1215;
					break;
				case /^kib.*/gi.test(subCounty):
					subCountyNo = 1216;
					break;
				case /^lang.*/gi.test(subCounty):
					subCountyNo = 1217;
					break;
				case /^mak.*/gi.test(subCounty):
					subCountyNo = 1218;
					break;
				case /^mat.*/gi.test(subCounty):
					subCountyNo = 1219;
					break;
				case /^nj.*/gi.test(subCounty):
					subCountyNo = 1220;
					break;
				case /^st.*/gi.test(subCounty):
					subCountyNo = 1221;
					break;
				case /^wes.*/gi.test(subCounty):
					subCountyNo = 1222;
					break;
				default:
					subCountyNo = 1221;
					break;
			}
			break;
		//if not matched return undefined to be handled by the calling function
		default:
			return undefined;
	}
	return {
		countyNo: countyNo,
		subCountyNo: subCountyNo
	};
};
//converts nationalities to their respective codes and vice varsa as per nemis
export const nationalities = (nationality: number | string): number | string => {
	if (typeof nationality === 'string') {
		switch (true) {
			case /ke/g.test(nationality):
				nationality = 1;
				break;
			case /su/g.test(nationality):
				nationality = 2;
				break;
			case /tan/g.test(nationality):
				nationality = 3;
				break;
			case /som/g.test(nationality):
				nationality = 4;
				break;
			case /et/g.test(nationality):
				nationality = 5;
				break;
			case /eu|ame/g.test(nationality):
				nationality = 6;
				break;
			case /afr/g.test(nationality):
				nationality = 7;
				break;
			case /ot/g.test(nationality):
				nationality = 8;
				break;
			default:
				nationality = 1;
				break;
		}
	} else if (typeof nationality === 'number') {
		switch (nationality) {
			case 1:
				nationality = 'Kenyan';
				break;
			case 2:
				nationality = 'Sudan';
				break;
			case 3:
				nationality = 'Tanzania';
				break;
			case 4:
				nationality = 'Somalia';
				break;
			case 5:
				nationality = 'Ethiopia';
				break;
			case 6:
				nationality = 'Europe | America';
				break;
			case 7:
				nationality = 'Africa';
				break;
			case 8:
				nationality = 'Others';
				break;
			default:
				nationality = 'Kenya';
				break;
		}
	}
	return nationality;
};

//converts classes as per nemis
export const form = (grade: Grades): number => {
	if (typeof grade === 'string') {
		if (grade.startsWith('form')) {
			switch (grade) {
				case 'form 1':
					return 12;
				case 'form 2':
					return 13;
				case 'form 3':
					return 14;
				case 'form 4':
					return 15;
				default:
					throw new Error(grade + ' is out of range');
			}
		}
		if (grade.startsWith('grade')) {
			switch (grade) {
				case 'pp 1':
					return 16;
				case 'pp 2':
					return 17;
				case 'grade 1':
					return 18;
				case 'grade 2':
					return 19;
				case 'grade 3':
					return 20;
				case 'grade 4':
					return 21;
				case 'grade 5':
					return 22;
				case 'grade 6':
					return 23;
				case 'grade 7':
					return 24;
				case 'grade 8':
					return 25;
				case 'grade 9':
					return 26;
				case 'grade 10':
					return 27;
				case 'grade 11':
					return 28;
				default:
					throw new Error(grade + ' is out of range');
			}
		}
	}
};

//split names into firstname, middlename and lastname
export const splitNames = (name: string): BasicName => {
	try {
		let nameArray: string[] = name?.split(' ');
		if (nameArray.length < 2) throw {message: 'Invalid name length'};
		switch (nameArray.length) {
			case 3:
				return {
					surname: nameArray[0],
					firstname: nameArray[1],
					otherName: nameArray[2]
				};
			case 2:
				return {
					surname: ' ',
					firstname: nameArray[0],
					otherName: nameArray[1]
				};
			default:
				return {
					surname: nameArray.shift(),
					otherName: nameArray.pop(),
					firstname: nameArray.join(' ')
				};
		}
	} catch (err) {
		throw err;
	}
};

export const setMedicalCondition = (medicalCondition: string): number => {
	//set medical condition
	// 1 = anemia, 2 = asthma, 3 = convulsions, 4 = diabeties, 5 = epilepsy, 0 = none
	let condition;
	switch (true) {
		case /an/g.test(medicalCondition):
			condition = 1;
			break;
		case /as/g.test(medicalCondition):
			condition = 2;
			break;
		case /con/g.test(medicalCondition):
			condition = 3;
			break;
		case /dia/g.test(medicalCondition):
			condition = 4;
			break;
		case /epi/g.test(medicalCondition):
			condition = 5;
			break;
		default:
			condition = 0;
			break;
	}
	return condition;
};

export function parseLearner(
	learnerJsonArray: NemisLearner[],
	institutionId?: ObjectId | string,
	extraData?: {}
): NemisLearnerFromDb[] {
	try {
		let cleanLearner = [];
		learnerJsonArray.forEach(learner => {
			let pushLearner = {
				mother: {},
				father: {},
				guardian: {}
			} as NemisLearnerFromDb;
			// refactor contacts
			Object.keys(learner).forEach(key => {
				switch (key) {
					case 'dob':
						if (!learner[key]) break;
						learner.dob = learner.dob.toString();
						break;
					case 'fatherName':
					case 'fatherId':
					case 'fatherTel':
						if (!learner[key]) break;
						Object.assign(pushLearner.father, {
							[key.replace('father', '')?.toLowerCase()]: learner[key]
						});
						delete learner[key];
						break;
					case 'motherName':
					case 'motherId':
					case 'motherTel':
						if (!learner[key]) break;
						Object.assign(pushLearner.mother, {
							[key.replace('mother', '')?.toLowerCase()]: learner[key]
						});
						delete learner[key];
						break;
					case 'guardianName':
					case 'guardianId':
					case 'guardianTel':
						if (!learner[key]) break;
						Object.assign(pushLearner.guardian, {
							[key.replace('guardian', '')?.toLowerCase()]: learner[key]
						});
						delete learner[key];
						break;
					case 'county':
					case 'subCounty':
						if (!learner[key]) break;
						let countyNo: {countyNo; subCountyNo} = countyToNo(
							learner.county,
							learner.subCounty
						);
						pushLearner.countyNo = countyNo.countyNo;
						pushLearner.subCountyNo = countyNo.subCountyNo;
						break;
					case 'form':
					case 'grade':
						if (!learner[key]) break;
						pushLearner.grade = learner[key]?.toLowerCase();
						delete learner[key];
						break;
					case 'gender':
						if (!learner[key]) break;
						pushLearner.gender = learner[key]?.toLowerCase();
						delete learner[key];
						break;
				}
			});
			pushLearner.institutionId = institutionId.toString();
			if (extraData && Object.keys(extraData).length > 0) {
				Object.entries(extraData).forEach(x => {
					pushLearner[x[0]] = x[1];
				});
			}
			cleanLearner.push({
				...learner,
				...pushLearner
			});
		});
		return cleanLearner;
	} catch (err) {
		throw {message: err?.message || 'failed to parse learner details', cause: err};
	}
}
