import * as fs from 'fs-extra';
import * as path from 'path';

import * as tl from 'azure-pipelines-task-lib/task';
import {Github} from "./utils/github";
import {GitClient} from "./utils/git-client";
import {getSourceBranch, getSourceCommitId} from "./utils/env";
import {getGithubEndPointToken} from "./utils/end-point-token";

function parseRepository(repository: string): { owner: string; repo: string } {
    const split = repository.split('/')
    return {
        owner: split[0],
        repo: split[1]
    }
}

function getVersionFromPackage(dirPath: string): string {
    const jsonPath = path.resolve(dirPath, 'package.json');
    const json = fs.readJSONSync(jsonPath);
    if (!json.version) {
        const errorMessage = `invalid package JSON ${dirPath}/package.json`;
        tl.setResult(tl.TaskResult.Failed, errorMessage)
        throw new Error(errorMessage);
    }
    return json.version;
}

class Main {
    static async run() {

        const taskManifestPath = path.join(__dirname, "task.json");
        tl.debug("Setting resource path to " + taskManifestPath);
        tl.setResourcePath(taskManifestPath);

        const githubEndpoint = tl.getInput('gitHubConnection', true);
        const gitHubRepository = tl.getInput('gitHubRepository', true);
        const buildsGitHubRepository = tl.getInput('buildsGitHubRepository', true);
        const buildsDir = tl.getInput('buildsDir', true);

        const sourceCommitId = getSourceCommitId();
        const sourceBranch = getSourceBranch();

        const workDir = tl.cwd();
        const buildsWorkDir = `${workDir}/temp/${buildsGitHubRepository}`;

        if(sourceBranch !== 'refs/heads/master') {
            tl.setResult(tl.TaskResult.Failed, tl.loc("InvalidSourceBranch", sourceBranch));
            throw new Error(tl.loc("InvalidSourceBranch", sourceBranch));
        }
        const githubEndpointToken = getGithubEndPointToken(githubEndpoint!);

        const gh = new Github(githubEndpointToken);
        const { owner, repo } = parseRepository(gitHubRepository!);

        const buildsRepoURL = `https://${githubEndpointToken}@github.com/${buildsGitHubRepository}.git`;

        const { sha, message } = await gh.getCommit(owner, repo, sourceCommitId).then(data => ({sha: data.sha.substr(0, 10), message: data.message}));
        const version = getVersionFromPackage(buildsDir!)

        tl.mkdirP(buildsWorkDir);
        const git = new GitClient(buildsWorkDir, buildsRepoURL);
        git.configUsernameG('ng-zorro-bot');
        git.configUserEmailG('ng-zorro-bot@users.noreply.github.com');
        git.spawnGitProcess(['config', '--global', 'core.autocrlf', 'false']);
        git.clone();

        fs.readdirSync(buildsWorkDir)
          .filter(file => file !== '.git')
          .forEach(file => {
              fs.removeSync(path.resolve(buildsWorkDir, file))
          });

        fs.copySync(buildsDir!, buildsWorkDir, {overwrite: true});

        git.stageAllChanges();
        git.createNewCommit(`${sha} ${message}`);
        const pushed = git.pushBranchToRemote('master', true);

        if (!pushed) {
            const errorMessage = `Push the builds to ${buildsGitHubRepository} failed`;
            tl.setResult(tl.TaskResult.Failed, errorMessage)
            throw new Error(errorMessage);
        }
        const { owner: buildsOwner, repo: buildsRepo } = parseRepository(buildsGitHubRepository!);

        const latestCommit = await gh.getLatestCommit(buildsOwner, buildsRepo);

        gh.release(
          buildsOwner,
          buildsRepo,
          `${version}+${sha}`,
          `[${message}](https://github.com/${gitHubRepository}/commit/${sha}) ${sha}\n\`github:${buildsGitHubRepository}#${latestCommit.sha}\``
        )
          .then(res => {
              if (res.data) {
                  tl.setResult(tl.TaskResult.Succeeded, res.data.tag_name);
              } else {
                  tl.setResult(tl.TaskResult.Failed, `Release failed with ${sha}`)
              }
          }).catch(err => {
              tl.setResult(tl.TaskResult.Failed, err);
        })

    }

}

Main.run();
