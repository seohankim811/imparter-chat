// 유닛/건물 플레이스홀더 프리팹을 자동으로 생성합니다.
#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using System.IO;

namespace LostCity.Editor
{
    public static class PrefabCreator
    {
        [MenuItem("LostCity/3. Create Placeholder Prefabs")]
        public static void CreatePrefabs()
        {
            string prefabPath = "Assets/Prefabs";
            Directory.CreateDirectory(prefabPath + "/Units");
            Directory.CreateDirectory(prefabPath + "/Buildings");
            Directory.CreateDirectory(prefabPath + "/Projectiles");

            // ─── 유닛 프리팹 ───────────────────────────────────────────────
            CreateUnitPrefab("Sophie_Foster", Color.white, typeof(Units.SophieFoster), prefabPath + "/Units");
            CreateUnitPrefab("Fitz_Vacker", Color.blue, typeof(Units.FitzVacker), prefabPath + "/Units");
            CreateUnitPrefab("Keefe_Sencen", Color.cyan, typeof(Units.KeefeSencen), prefabPath + "/Units");
            CreateUnitPrefab("Ability_Elf", Color.green, typeof(Units.AbilityElf), prefabPath + "/Units");
            CreateUnitPrefab("Goblin_Guard", new Color(0.5f, 0.3f, 0), typeof(Units.GoblinGuard), prefabPath + "/Units");
            CreateUnitPrefab("Neverseen_Agent", Color.red, typeof(Units.NeverseenAgent), prefabPath + "/Units");
            CreateUnitPrefab("Disguised_Agent", Color.magenta, typeof(Units.DisguisedAgent), prefabPath + "/Units");

            // ─── 건물 프리팹 ───────────────────────────────────────────────
            CreateBuildingPrefab("CouncilHall", Color.cyan, typeof(Buildings.CouncilHall), new Vector3(4, 3, 4), prefabPath + "/Buildings");
            CreateBuildingPrefab("FoxfireAcademy", Color.blue, typeof(Buildings.FoxfireAcademy), new Vector3(4, 2.5f, 4), prefabPath + "/Buildings");
            CreateBuildingPrefab("ElysianMine", Color.yellow, typeof(Buildings.ElysianMine), new Vector3(2, 1.5f, 2), prefabPath + "/Buildings");
            CreateBuildingPrefab("GuardianTower", Color.green, typeof(Buildings.GuardianTower), new Vector3(1.5f, 4, 1.5f), prefabPath + "/Buildings");
            CreateBuildingPrefab("NeverseenBase", Color.red, typeof(Buildings.NeverseenBase), new Vector3(5, 4, 5), prefabPath + "/Buildings");

            // ─── 발사체 프리팹 ──────────────────────────────────────────────
            CreateProjectilePrefab(prefabPath + "/Projectiles");

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog("프리팹 생성 완료",
                "Assets/Prefabs/ 에 플레이스홀더 프리팹이 생성되었습니다.\n각 UnitData/BuildingData의 Prefab 필드에 연결하세요.",
                "확인");
        }

        private static void CreateUnitPrefab(string name, Color color, System.Type script, string folder)
        {
            string path = $"{folder}/{name}.prefab";
            if (AssetDatabase.LoadAssetAtPath<GameObject>(path) != null) return;

            // Body
            var root = new GameObject(name);
            var body = GameObject.CreatePrimitive(PrimitiveType.Capsule);
            body.name = "Body";
            body.transform.SetParent(root.transform);
            body.transform.localPosition = new Vector3(0, 1, 0);
            body.GetComponent<Renderer>().sharedMaterial = MakeMat(color);

            // NavMesh Agent
            var agent = root.AddComponent<UnityEngine.AI.NavMeshAgent>();
            agent.radius = 0.5f;
            agent.height = 2f;

            // Script
            root.AddComponent(script);

            // DebuffComponent (for debuffable units)
            root.AddComponent<Abilities.DebuffComponent>();

            // HealthBar canvas
            var hbCanvas = new GameObject("HealthBarCanvas");
            hbCanvas.transform.SetParent(root.transform);
            hbCanvas.transform.localPosition = new Vector3(0, 2.5f, 0);
            var canvas = hbCanvas.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            hbCanvas.AddComponent<UI.HealthBar>();

            // Health bar background
            var bg = new GameObject("Background");
            bg.transform.SetParent(hbCanvas.transform);
            var bgImg = bg.AddComponent<UnityEngine.UI.Image>();
            bgImg.color = Color.black;
            var bgRt = bg.GetComponent<RectTransform>();
            bgRt.sizeDelta = new Vector2(1f, 0.15f);

            // Health bar fill
            var fill = new GameObject("Fill");
            fill.transform.SetParent(bg.transform);
            var fillImg = fill.AddComponent<UnityEngine.UI.Image>();
            fillImg.color = color == Color.red ? Color.red : Color.green;
            fillImg.type = UnityEngine.UI.Image.Type.Filled;
            fillImg.fillMethod = UnityEngine.UI.Image.FillMethod.Horizontal;
            var fillRt = fill.GetComponent<RectTransform>();
            fillRt.anchorMin = Vector2.zero;
            fillRt.anchorMax = Vector2.one;
            fillRt.offsetMin = Vector2.zero;
            fillRt.offsetMax = Vector2.zero;

            SavePrefab(root, path);
        }

        private static void CreateBuildingPrefab(string name, Color color, System.Type script,
            Vector3 scale, string folder)
        {
            string path = $"{folder}/{name}.prefab";
            if (AssetDatabase.LoadAssetAtPath<GameObject>(path) != null) return;

            var root = new GameObject(name);
            var body = GameObject.CreatePrimitive(PrimitiveType.Cube);
            body.name = "Body";
            body.transform.SetParent(root.transform);
            body.transform.localScale = scale;
            body.transform.localPosition = new Vector3(0, scale.y / 2f, 0);
            body.GetComponent<Renderer>().sharedMaterial = MakeMat(color);

            root.AddComponent(script);

            var rally = new GameObject("RallyPoint");
            rally.transform.SetParent(root.transform);
            rally.transform.localPosition = new Vector3(0, 0, scale.z / 2f + 1.5f);

            SavePrefab(root, path);
        }

        private static void CreateProjectilePrefab(string folder)
        {
            string path = $"{folder}/TelekineticProjectile.prefab";
            if (AssetDatabase.LoadAssetAtPath<GameObject>(path) != null) return;

            var root = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            root.name = "TelekineticProjectile";
            root.transform.localScale = Vector3.one * 0.3f;
            root.GetComponent<Renderer>().sharedMaterial = MakeMat(new Color(0.3f, 0.7f, 1f));
            root.AddComponent<Units.TelekineticProjectile>();

            SavePrefab(root, path);
        }

        private static void SavePrefab(GameObject go, string path)
        {
            PrefabUtility.SaveAsPrefabAsset(go, path);
            Object.DestroyImmediate(go);
        }

        private static Material MakeMat(Color color)
        {
            var mat = new Material(Shader.Find("Standard"));
            mat.color = color;
            return mat;
        }
    }
}
#endif
