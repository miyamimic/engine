# Google IDX / Project IDX 环境配置
# 此文件仅被 Google IDX 识别，不影响秒搭平台或静态部署。
{ pkgs, ... }: {
  channel = "stable-24.05";

  packages = [
    pkgs.nodejs_20
    pkgs.python311
  ];

  env = { };

  idx = {
    extensions = [
      "ms-python.python"
      "bradlc.vscode-tailwindcss"
      "dbaeumer.vscode-eslint"
    ];

    workspace = {
      # 首次打开工作区时执行
      onCreate = {
        npm-install = "npm install";
        # 只装核心后端依赖；spacy 可选（缺失时 NLP 层自动降级为启发式+LLM，不影响主流程）
        pip-install = "pip install fastapi uvicorn httpx pydantic";
      };
    };

    # 后台常驻进程
    processes = {
      backend = {
        command = [
          "bash" "-c"
          "cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
        ];
      };
    };

    # Web 预览：IDX 会通过 $PORT 注入端口，传给 dev.mjs 的 CLIENT_DEV_PORT
    previews = {
      enable = true;
      previews = {
        web = {
          command = [ "npm" "run" "dev" ];
          manager = "web";
          env = {
            CLIENT_DEV_PORT = "$PORT";
          };
        };
      };
    };
  };
}
