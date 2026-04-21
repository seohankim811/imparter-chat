// Editor script: Unity 메뉴 > LostCity > Setup Scene 실행 시 씬 자동 구성
#if UNITY_EDITOR
using UnityEngine;
using UnityEditor;
using UnityEngine.AI;
using System.IO;

namespace LostCity.Editor
{
    public static class SceneSetup
    {
        [MenuItem("LostCity/1. Setup Scene")]
        public static void SetupScene()
        {
            // ─── 매니저 오브젝트 ───────────────────────────────────────────
            var managers = GetOrCreate("--- MANAGERS ---");
            AddComponent<Core.GameManager>(managers);
            AddComponent<Core.ResourceManager>(managers);
            AddComponent<Core.SelectionManager>(managers);
            AddComponent<Units.UnitFactory>(managers);
            AddComponent<Player.PlayerInputHandler>(managers);
            AddComponent<Player.CommandDispatcher>(managers);
            AddComponent<Buildings.BuildingPlacer>(managers);

            // ─── 카메라 ───────────────────────────────────────────────────
            var camGo = GameObject.FindFirstObjectByType<UnityEngine.Camera>()?.gameObject
                        ?? new GameObject("Main Camera");
            camGo.tag = "MainCamera";
            camGo.transform.position = new Vector3(0, 20, -15);
            camGo.transform.rotation = Quaternion.Euler(55, 0, 0);
            if (!camGo.GetComponent<UnityEngine.Camera>()) camGo.AddComponent<UnityEngine.Camera>();
            AddComponent<Camera.RTSCameraController>(camGo);

            // ─── 조명 ──────────────────────────────────────────────────────
            if (GameObject.FindFirstObjectByType<Light>() == null)
            {
                var light = new GameObject("Directional Light");
                var l = light.AddComponent<Light>();
                l.type = LightType.Directional;
                l.intensity = 1f;
                light.transform.rotation = Quaternion.Euler(45, -30, 0);
            }

            // ─── 지형 ──────────────────────────────────────────────────────
            var ground = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ground.name = "Ground";
            ground.transform.localScale = new Vector3(10, 1, 10);
            ground.GetComponent<Renderer>().sharedMaterial = CreateGroundMaterial();
            GameObjectUtility.SetStaticEditorFlags(ground, StaticEditorFlags.NavigationStatic);

            // ─── 플레이어 진영 건물 ─────────────────────────────────────────
            CreatePlaceholderBuilding("Council Hall [ElfCouncil]",
                new Vector3(-20, 0, 0), typeof(Buildings.CouncilHall), Color.cyan);

            CreatePlaceholderBuilding("Foxfire Academy [ElfCouncil]",
                new Vector3(-15, 0, 5), typeof(Buildings.FoxfireAcademy), Color.blue);

            CreatePlaceholderBuilding("Elysian Mine [ElfCouncil]",
                new Vector3(-25, 0, 5), typeof(Buildings.ElysianMine), Color.yellow);

            CreatePlaceholderBuilding("Guardian Tower [ElfCouncil]",
                new Vector3(-18, 0, -5), typeof(Buildings.GuardianTower), Color.green);

            // ─── 네버세인 진영 건물 ─────────────────────────────────────────
            var neverseenBase = CreatePlaceholderBuilding("Neverseen Base",
                new Vector3(20, 0, 0), typeof(Buildings.NeverseenBase), Color.red);

            // 스폰 포인트 추가
            for (int i = 0; i < 3; i++)
            {
                var sp = new GameObject($"SpawnPoint_{i}");
                sp.transform.parent = neverseenBase.transform;
                sp.transform.localPosition = new Vector3((i - 1) * 3f, 0, -3);
            }

            // ─── AI 컨트롤러 ──────────────────────────────────────────────
            var aiGo = GetOrCreate("AI Controller");
            var aiCtrl = AddComponent<AI.AIController>(aiGo);
            var aiRes = AddComponent<AI.AIResourceManager>(aiGo);

            // ─── UI Canvas ────────────────────────────────────────────────
            SetupUI();

            // ─── NavMesh Bake 안내 ─────────────────────────────────────────
            Debug.Log("[LostCity] 씬 설정 완료! Window > AI > Navigation 에서 Bake 버튼을 눌러 NavMesh를 구워주세요.");
            EditorUtility.DisplayDialog("LostCity 씬 설정 완료",
                "씬 기본 구성이 완료되었습니다!\n\n다음 단계:\n1. Window > AI > Navigation > Bake\n2. LostCity > 2. Create Default Assets\n3. ScriptableObject를 각 컴포넌트에 연결",
                "확인");

            UnityEditor.SceneManagement.EditorSceneManager.MarkSceneDirty(
                UnityEditor.SceneManagement.EditorSceneManager.GetActiveScene());
        }

        [MenuItem("LostCity/2. Create Default Assets")]
        public static void CreateDefaultAssets()
        {
            string basePath = "Assets/Data";
            Directory.CreateDirectory(basePath + "/Units");
            Directory.CreateDirectory(basePath + "/Buildings");
            Directory.CreateDirectory(basePath + "/Abilities");

            // ─── UnitData 생성 ─────────────────────────────────────────────
            CreateUnitData(basePath + "/Units/Sophie_Foster.asset",
                "소피 포스터", Core.Faction.ElfCouncil, 150f, 3.5f, 3f, 20f, 1.5f, 0, 0f);
            CreateUnitData(basePath + "/Units/Fitz_Vacker.asset",
                "피츠 배커", Core.Faction.ElfCouncil, 100f, 4f, 7f, 18f, 1.2f, 60, 6f);
            CreateUnitData(basePath + "/Units/Keefe_Sencen.asset",
                "키페 소엔케", Core.Faction.ElfCouncil, 90f, 3.8f, 5f, 12f, 2f, 60, 6f);
            CreateUnitData(basePath + "/Units/Ability_Elf.asset",
                "능력자 엘프", Core.Faction.ElfCouncil, 80f, 3.5f, 2.5f, 15f, 1.5f, 50, 5f);
            CreateUnitData(basePath + "/Units/Goblin_Guard.asset",
                "고블린 경호원", Core.Faction.ElfCouncil, 200f, 2.5f, 1.5f, 12f, 1.8f, 70, 7f);
            CreateUnitData(basePath + "/Units/Neverseen_Agent.asset",
                "네버세인 요원", Core.Faction.Neverseen, 80f, 3.5f, 2f, 14f, 1.5f, 50, 5f);
            CreateUnitData(basePath + "/Units/Disguised_Agent.asset",
                "위장 요원", Core.Faction.Neverseen, 70f, 4f, 2f, 12f, 1.5f, 70, 6f);

            // ─── BuildingData 생성 ──────────────────────────────────────────
            CreateBuildingData(basePath + "/Buildings/CouncilHall.asset",
                "의회 홀", Core.Faction.ElfCouncil, 1000f, 0, 0f);
            CreateBuildingData(basePath + "/Buildings/FoxfireAcademy.asset",
                "폭스파이어 학교", Core.Faction.ElfCouncil, 400f, 150, 12f);
            CreateBuildingData(basePath + "/Buildings/ElysianMine.asset",
                "엘리시안 광산", Core.Faction.ElfCouncil, 300f, 100, 8f);
            CreateBuildingData(basePath + "/Buildings/GuardianTower.asset",
                "수호자 탑", Core.Faction.ElfCouncil, 250f, 80, 5f);
            CreateBuildingData(basePath + "/Buildings/NeverseenBase.asset",
                "네버세인 기지", Core.Faction.Neverseen, 1500f, 0, 0f);

            // ─── AbilityData 생성 ──────────────────────────────────────────
            CreateAbilityData(basePath + "/Abilities/Telepathy.asset",
                "텔레파시", 20f, 15f, "범위 내 위장 요원을 모두 탐지하고 폭로합니다.");
            CreateAbilityData(basePath + "/Abilities/EmotionSurge.asset",
                "감정 폭풍", 15f, 8f, "범위 내 적의 공격력과 이동 속도를 일시적으로 감소시킵니다.");

            AssetDatabase.SaveAssets();
            AssetDatabase.Refresh();

            EditorUtility.DisplayDialog("Assets 생성 완료",
                "Assets/Data/ 폴더에 ScriptableObject 파일들이 생성되었습니다.\n각 컴포넌트의 Inspector에서 연결해주세요.",
                "확인");
        }

        // ─── 헬퍼 메서드 ────────────────────────────────────────────────────

        private static GameObject GetOrCreate(string name)
        {
            var go = GameObject.Find(name) ?? new GameObject(name);
            return go;
        }

        private static T AddComponent<T>(GameObject go) where T : Component
        {
            return go.GetComponent<T>() ?? go.AddComponent<T>();
        }

        private static GameObject CreatePlaceholderBuilding(string name, Vector3 pos, System.Type script, Color color)
        {
            var cube = GameObject.CreatePrimitive(PrimitiveType.Cube);
            cube.name = name;
            cube.transform.position = pos;
            cube.transform.localScale = new Vector3(4, 3, 4);
            cube.GetComponent<Renderer>().sharedMaterial = CreateColorMaterial(color);

            if (script != null)
                cube.AddComponent(script);

            // Rally point
            var rally = new GameObject("RallyPoint");
            rally.transform.parent = cube.transform;
            rally.transform.localPosition = new Vector3(0, -0.5f, 3);

            return cube;
        }

        private static void SetupUI()
        {
            // Canvas
            var canvasGo = new GameObject("UI Canvas");
            var canvas = canvasGo.AddComponent<UnityEngine.Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            canvasGo.AddComponent<UnityEngine.UI.CanvasScaler>();
            canvasGo.AddComponent<UnityEngine.UI.GraphicRaycaster>();

            // Resource display
            var resourcePanel = new GameObject("ResourcePanel");
            resourcePanel.transform.parent = canvasGo.transform;
            var rt = resourcePanel.AddComponent<RectTransform>();
            rt.anchorMin = new Vector2(0, 1);
            rt.anchorMax = new Vector2(0, 1);
            rt.pivot = new Vector2(0, 1);
            rt.anchoredPosition = new Vector2(10, -10);
            rt.sizeDelta = new Vector2(250, 40);
            resourcePanel.AddComponent<UI.ResourceUI>();

            var text = new GameObject("CrystalText");
            text.transform.parent = resourcePanel.transform;
            var tmp = text.AddComponent<TMPro.TextMeshProUGUI>();
            tmp.text = "엘리시안 결정: 200";
            tmp.fontSize = 18;
            tmp.color = Color.white;
            var textRt = text.GetComponent<RectTransform>();
            textRt.anchorMin = Vector2.zero;
            textRt.anchorMax = Vector2.one;
            textRt.offsetMin = Vector2.zero;
            textRt.offsetMax = Vector2.zero;

            // Game Over Screen
            var gameOverGo = new GameObject("GameOverScreen");
            gameOverGo.transform.parent = canvasGo.transform;
            gameOverGo.AddComponent<UI.GameOverScreen>();

            Debug.Log("[LostCity] UI Canvas 기본 구성 완료. Inspector에서 패널을 연결하세요.");
        }

        private static Material CreateGroundMaterial()
        {
            var mat = new Material(Shader.Find("Standard"));
            mat.color = new Color(0.2f, 0.4f, 0.2f);
            return mat;
        }

        private static Material CreateColorMaterial(Color color)
        {
            var mat = new Material(Shader.Find("Standard"));
            mat.color = color;
            return mat;
        }

        private static void CreateUnitData(string path, string unitName, Core.Faction faction,
            float hp, float speed, float range, float damage, float cooldown, int cost, float trainTime)
        {
            if (AssetDatabase.LoadAssetAtPath<Data.UnitData>(path) != null) return;
            var data = ScriptableObject.CreateInstance<Data.UnitData>();
            data.UnitName = unitName;
            data.Faction = faction;
            data.MaxHealth = hp;
            data.MoveSpeed = speed;
            data.AttackRange = range;
            data.AttackDamage = damage;
            data.AttackCooldown = cooldown;
            data.CrystalCost = cost;
            data.TrainingTime = trainTime;
            AssetDatabase.CreateAsset(data, path);
        }

        private static void CreateBuildingData(string path, string bldName, Core.Faction faction,
            float hp, int cost, float buildTime)
        {
            if (AssetDatabase.LoadAssetAtPath<Data.BuildingData>(path) != null) return;
            var data = ScriptableObject.CreateInstance<Data.BuildingData>();
            data.BuildingName = bldName;
            data.Faction = faction;
            data.MaxHealth = hp;
            data.CrystalCost = cost;
            data.BuildTime = buildTime;
            AssetDatabase.CreateAsset(data, path);
        }

        private static void CreateAbilityData(string path, string abilityName, float cooldown, float range, string desc)
        {
            if (AssetDatabase.LoadAssetAtPath<Data.AbilityData>(path) != null) return;
            var data = ScriptableObject.CreateInstance<Data.AbilityData>();
            data.AbilityName = abilityName;
            data.Cooldown = cooldown;
            data.Range = range;
            data.Description = desc;
            AssetDatabase.CreateAsset(data, path);
        }
    }
}
#endif
